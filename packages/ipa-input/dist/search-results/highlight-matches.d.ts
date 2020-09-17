/// <reference types="react" />
export declare type HighlightedMatch = JSX.Element | (string | JSX.Element)[];
declare const highlightMatches: (term: string, query: string, cache: Map<string, HighlightedMatch>, outerKey?: string | number | undefined) => HighlightedMatch;
export default highlightMatches;
