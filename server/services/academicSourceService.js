const log = require('../utils/logger');
/**
 * Academic Source Intelligence Layer
 * 
 * Retrieves verifiable, structured scholarly papers directly from academic APIs.
 * It uses OpenAlex as a primary metadata graph and arXiv for pre-prints.
 */

const axios = require('axios');
const cheerio = require('cheerio');

const OPENALEX_API = 'https://api.openalex.org/works';
const ARXIV_API = 'http://export.arxiv.org/api/query';

const academicSourceService = {
  /**
   * Primary retrieval function for academic sources using OpenAlex & ArXiv
   * @param {string} query Search terms
   * @param {Object} options Configuration flags
   * @returns {Promise<Array>} Array of AcademicSource schema objects
   */
  async retrieveSources(query, options = { limit: 5 }) {
    log.info('RESEARCH', `Searching academic sources for: "${query.substring(0, 40)}..."`);
    const limit = options.limit || 5;

    try {
      // Parallel fetch from both hubs
      const [openAlexResults, arxivResults] = await Promise.allSettled([
        this.fetchOpenAlex(query, limit),
        this.fetchArxiv(query, limit)
      ]);

      let sources = [];

      if (openAlexResults.status === 'fulfilled') {
        sources.push(...openAlexResults.value);
      }

      if (arxivResults.status === 'fulfilled') {
        // Merge ArXiv results, deduplicating by title/doi if possible
        for (const arx of arxivResults.value) {
            const exists = sources.find(s => 
                (s.title && s.title.toLowerCase() === arx.title.toLowerCase()) || 
                (s.doi && arx.doi && s.doi === arx.doi)
            );
            if (!exists) {
                sources.push(arx);
            }
        }
      }

      // Sort by initial citation count footprint
      sources.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));

      return sources.slice(0, limit);
    } catch (err) {
      log.error('RESEARCH', `Academic source query error: ${err.message}`);
      return [];
    }
  },

  async fetchOpenAlex(query, limit) {
    try {
      // Build a strict query for OpenAlex
      const response = await axios.get(OPENALEX_API, {
        params: {
          search: query,
          per_page: limit,
          sort: 'cited_by_count:desc'
        },
        timeout: 8000
      });

      const works = response.data.results || [];
      return works.map(work => ({
        title: work.title || 'Untitled',
        content: this.reconstructOpenAlexAbstract(work.abstract_inverted_index), // 'content' used for legacy mapping
        abstract: this.reconstructOpenAlexAbstract(work.abstract_inverted_index),
        authors: work.authorships ? work.authorships.map(a => a.author?.display_name).filter(Boolean) : [],
        year: work.publication_year || new Date().getFullYear(),
        doi: work.doi ? work.doi.replace('https://doi.org/', '') : null,
        url: work.id || work.doi,
        citationCount: work.cited_by_count || 0,
        concepts: work.concepts ? work.concepts.map(c => c.display_name) : [],
        referenced_works: work.referenced_works || [],
        sourceType: 'academic',
        credibilityBaseScore: 85 // high initial score for OA metadata
      }));
    } catch (err) {
      log.warn('RESEARCH', `OpenAlex error: ${err.message}`);
      return [];
    }
  },

  async fetchArxiv(query, limit) {
    try {
      // Basic query formulation
      const arxivQuery = query.split(' ').join('+AND+');
      const response = await axios.get(ARXIV_API, {
        params: {
          search_query: `all:${arxivQuery}`,
          start: 0,
          max_results: limit,
          sortBy: 'relevance',
          sortOrder: 'descending'
        },
        timeout: 8000
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      const entries = $('entry').toArray();

      return entries.map(entry => {
        const el = $(entry);
        const title = el.find('title').text().trim().replace(/\s+/g, ' ');
        const abstract = el.find('summary').text().trim().replace(/\s+/g, ' ');
        const publishedDate = el.find('published').text();
        const year = publishedDate ? new Date(publishedDate).getFullYear() : new Date().getFullYear();
        const idUrl = el.find('id').text();
        const arxivId = idUrl.split('/abs/')[1] || idUrl;
        
        let doi = null;
        el.find('link[title="doi"]').each((_, link) => {
            doi = $(link).attr('href');
        });
        if (doi) doi = doi.replace('http://dx.doi.org/', '').replace('https://doi.org/', '');

        const authors = [];
        el.find('author name').each((_, name) => {
            authors.push($(name).text());
        });

        return {
          title,
          content: abstract, 
          abstract,
          authors,
          year,
          doi,
          url: idUrl,
          arxivId,
          citationCount: 0, // Unreliable on bare ArXiv XML
          concepts: [],
          referenced_works: [], // ArXiv doesn't provide this clearly in basic API
          sourceType: 'academic',
          credibilityBaseScore: 80 // Base limit for ArXiv preprints
        };
      });

    } catch (err) {
      log.warn('RESEARCH', `ArXiv error: ${err.message}`);
      return [];
    }
  },

  /**
   * OpenAlex returns abstracts as an inverted index to save bandwidth.
   * This reconstructs the string.
   */
  reconstructOpenAlexAbstract(invertedIndex) {
    if (!invertedIndex) return "No abstract available.";
    
    let maxLen = 0;
    const wordList = [];
    
    for (const [word, positions] of Object.entries(invertedIndex)) {
      for (const pos of positions) {
        wordList[pos] = word;
        if (pos > maxLen) maxLen = pos;
      }
    }
    
    return Array.from({ length: maxLen + 1 }, (_, i) => wordList[i] || '').join(' ').trim();
  }
};

module.exports = academicSourceService;
