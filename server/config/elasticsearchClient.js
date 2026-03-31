// server/config/elasticsearchClient.js
const { Client } = require('@elastic/elasticsearch');
const log = require('../utils/logger');

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

let esClient;

try {
    esClient = new Client({ node: ELASTICSEARCH_URL });
    log.success('ELASTIC', "Elasticsearch client configured.");
} catch (error) {
    log.error('ELASTIC', "Could not create Elasticsearch client", error);
    esClient = null;
}

module.exports = esClient;
