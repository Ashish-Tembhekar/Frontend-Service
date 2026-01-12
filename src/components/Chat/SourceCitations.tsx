import React, { useState, useMemo } from 'react';
import { FileText, ChevronDown, ChevronUp, File } from 'lucide-react';
import { Source } from '../../types/chat';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Button } from '../ui/button';

interface SourceCitationsProps {
    sources: Source[];
}

export const SourceCitations: React.FC<SourceCitationsProps> = ({ sources }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Group sources by filename (source field)
    const groupedSources = useMemo(() => {
        if (!sources) return [];
        const groups: Record<string, Source[]> = {};
        sources.forEach(s => {
            const fileName = s.source || 'Unknown Document';
            if (!groups[fileName]) {
                groups[fileName] = [];
            }
            groups[fileName].push(s);
        });
        return Object.entries(groups).map(([fileName, sources]) => ({
            fileName,
            sources
        }));
    }, [sources]);

    if (!sources || sources.length === 0) return null;

    return (
        <div className="w-full mt-3 animate-in fade-in slide-in-from-bottom-1 duration-500">

            {/* Collapsed View: List of unique files */}
            {!isExpanded && (
                <div className="flex flex-col gap-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                        Sources
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {groupedSources.map((group, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50/80 px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                                <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <div className="flex flex-col min-w-0">
                                    <span className="font-medium truncate text-xs sm:text-sm">{group.fileName}</span>
                                    {/* Optional: Add context like page numbers if there are few */}
                                    {/* <span className="text-[10px] text-gray-500">
                                        Used {group.sources.length} chunk{group.sources.length !== 1 ? 's' : ''}
                                    </span> */}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setIsExpanded(true)}
                        className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors self-start px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-200"
                    >
                        <span>View {sources.length} chunks</span>
                        <ChevronDown className="w-3 h-3" />
                    </button>
                </div>
            )}

            {/* Expanded View: Original Horizontal Scroll */}
            {isExpanded && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-200"
                        >
                            <ChevronUp className="w-3 h-3" />
                            <span>Hide Details</span>
                        </button>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                            {sources.length} Chunks
                        </span>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                        {sources.map((source, index) => (
                            <SourceCard key={index} source={source} index={index} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const SourceCard: React.FC<{ source: Source; index: number }> = ({ source, index }) => {
    // Determine label: Page X or Section Name
    const fileName = source.source || `Source ${index + 1}`;

    // Construct label as: {File NAME} > Chapter or section > page Number
    // Or shortened version for the card

    // For the CARD, we probably want to keep it concise but informative.
    // Let's try to fit the requested format, but truncated if needed.
    // "Doc.pdf > Section... > p.5"

    // Ideally card shows: 
    // Top: Filename
    // Bottom: Page/Section

    let mainInfo = fileName;

    const parts = [];
    if (source.section) parts.push(source.section);
    if (source.page) parts.push(`p. ${source.page}`);

    const subInfo = parts.join(' › ');

    const previewText = source.content_preview || "No content preview available.";

    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <div className="flex-shrink-0 cursor-help group select-none">
                        <div className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 hover:bg-white hover:shadow-sm hover:border-blue-200 border border-slate-200 rounded-lg transition-all duration-200 w-auto max-w-[240px]">
                            <div className="flex-shrink-0 bg-white p-1.5 rounded-md border border-slate-100 text-blue-500 shadow-sm group-hover:text-blue-600 group-hover:border-blue-100">
                                <FileText size={14} />
                            </div>
                            <div className="flex flex-col min-w-0 overflow-hidden text-left">
                                <span className="text-xs font-semibold text-slate-700 truncate w-full group-hover:text-slate-900" title={fileName}>
                                    {fileName}
                                </span>
                                {subInfo && (
                                    <span className="text-[10px] text-slate-500 truncate w-full group-hover:text-slate-600" title={subInfo}>
                                        {subInfo}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm bg-white text-slate-800 border-slate-200 shadow-xl z-50 p-0 overflow-hidden rounded-xl">
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex flex-col items-start gap-1">
                        <span className="font-semibold text-xs text-slate-700 break-words w-full">{fileName}</span>
                        {subInfo && <span className="text-[10px] text-slate-500 truncate w-full">{subInfo}</span>}
                    </div>
                    <div className="p-3 bg-white">
                        <p className="text-xs leading-relaxed text-slate-600 max-h-60 overflow-y-auto whitespace-pre-wrap font-mono">
                            {previewText}
                        </p>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
