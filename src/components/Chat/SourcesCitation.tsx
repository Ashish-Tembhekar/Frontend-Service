// src/components/Chat/SourcesCitation.tsx
import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import type { LLMSource } from '../../types/chat';

interface SourcesCitationProps {
    sources: LLMSource[];
}

export function SourcesCitation({ sources }: SourcesCitationProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!sources || sources.length === 0) {
        return null;
    }

    // Deduplicate sources by source+page+section
    const uniqueSources = sources.reduce((acc: LLMSource[], current) => {
        const key = `${current.source}-${current.page}-${current.section}`;
        if (!acc.some(s => `${s.source}-${s.page}-${s.section}` === key)) {
            acc.push(current);
        }
        return acc;
    }, []);

    return (
        <div className="w-full mt-3">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 
                   bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 
                   transition-all duration-200 w-full justify-between"
            >
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    <span className="font-medium">
                        Sources ({uniqueSources.length})
                    </span>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                ) : (
                    <ChevronDown className="w-4 h-4" />
                )}
            </button>

            {isExpanded && (
                <div className="mt-2 space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                    {uniqueSources.map((source, idx) => (
                        <div
                            key={idx}
                            className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 
                         shadow-sm hover:shadow-md transition-shadow duration-200"
                        >
                            <div className="flex-shrink-0 mt-0.5">
                                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {source.source}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                    <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 rounded-full">
                                        Page {source.page}
                                    </span>
                                    {source.section && (
                                        <span className="truncate text-gray-600">
                                            {source.section}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
