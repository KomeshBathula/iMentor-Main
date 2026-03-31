import React, { useState } from 'react';
import { ExternalLink, Database, Globe, Book, ChevronDown, CheckCircle } from 'lucide-react';

export default function SourceCard({ source }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine icon and label
  let Icon = Globe;
  let typeLabel = 'Web Source';

  if (source.type === 'academic' || source.sourceType === 'academic') {
    Icon = Book;
    typeLabel = source.url?.includes('arxiv') ? 'arXiv Preprint' : 'Academic Journal';
  } else if (source.type === 'local' || source.sourceType === 'local') {
    Icon = Database;
    typeLabel = 'Local Knowledge Base';
  }

  const score = source.credibilityScore || 0;
  
  // Create a subtle meter for score
  const scorePercent = Math.min(100, Math.max(0, score));

  return (
    <div className={`border-b border-[#1A1A1A] bg-[#0B0B0B] transition-all duration-200 group relative`}>
      {/* Citation indicator mark */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#121212] group-hover:bg-[#1A1A1A] transition-colors" />

      {/* CARD HEADER (Always Visible) */}
      <div 
        className="px-6 py-5 cursor-pointer flex flex-col gap-2 relative pl-8"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h4 className="text-[15px] font-semibold text-[#FFFFFF] leading-snug group-hover:text-[#00D1FF] transition-colors pr-8">
              [{source.id || source.citationIndex || '?'}] {source.title || 'Untitled Source'}
            </h4>
            
            <div className="text-[13px] text-[#B3B3B3] mt-1.5 truncate">
              {source.authors?.join(', ') || 'Unknown Author'} • {source.year || 'Unknown Year'}
            </div>
            
            {!isExpanded && (
                <p className="text-[13px] text-[#666666] mt-3 line-clamp-2 leading-relaxed">
                    {source.abstract || source.content || 'No text snippet available.'}
                </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0 py-1">
             <ChevronDown className={`w-4 h-4 text-[#666666] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
             
             {/* Subtle Score Meter */}
             <div className="flex items-center gap-2 group/meter mt-auto" title={`Credibility Score: ${scorePercent}`}>
                <div className="w-12 h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                   <div 
                      className={`h-full ${scorePercent >= 80 ? 'bg-[#FFFFFF]' : 'bg-[#666666]'}`} 
                      style={{ width: `${scorePercent}%` }} 
                   />
                </div>
                <span className="text-[10px] font-mono text-[#666666] group-hover/meter:text-[#FFFFFF] transition-colors w-6 text-right">
                  {score}
                </span>
             </div>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-[#666666] mt-2 pt-2 border-t border-transparent group-hover:border-[#1A1A1A] transition-colors border-dashed">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
               <Icon className="w-3 h-3" />
               {typeLabel}
            </span>
            {source.citationCount !== undefined && source.citationCount > 0 && (
               <span>• {source.citationCount} Citations</span>
            )}
        </div>
      </div>

      {/* EXPANDED CONTENT AREA */}
      <div 
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-6 pt-2 pl-8 space-y-5 border-t border-[#121212]">
            
            <div className="prose prose-invert prose-sm max-w-none text-[#B3B3B3] leading-relaxed text-[14px]">
              <p>
                {source.abstract || source.content?.substring(0, 800) + '...' || 'No abstract available.'}
              </p>
            </div>

            {source.credibilityReason && (
              <div className="bg-[#121212] p-4 rounded border border-[#1A1A1A]">
                <h5 className="text-[10px] uppercase tracking-widest text-[#666666] font-mono mb-2">Evaluation Logic</h5>
                <p className="text-[13px] text-[#B3B3B3] leading-relaxed">
                  {source.credibilityReason}
                </p>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-[#121212]">
              <span className="text-[11px] font-mono text-[#666666]">
                ID: {source.doi || source.url?.split('/').pop() || 'N/A'}
              </span>
              
              {source.url && !source.url.startsWith('local://') && (
                <a 
                  href={source.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#FFFFFF] hover:text-[#00D1FF] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Original Reference
                </a>
              )}
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
