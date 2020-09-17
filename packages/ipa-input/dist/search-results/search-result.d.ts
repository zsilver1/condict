/// <reference types="react" />
import { HighlightedMatch } from './highlight-matches';
export declare type Props = {
    char: {
        input: string;
        display: string;
        nameWords: string[];
    };
    match: {
        terms: {
            term: string;
            query: string;
        }[];
    };
    highlightCache: Map<string, HighlightedMatch>;
};
declare const SearchResult: (props: Props) => JSX.Element;
export default SearchResult;
