'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var React = require('react');
var styled = require('styled-components');
var ui = require('@condict/ui');
var ipa = require('@condict/ipa');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var React__default = /*#__PURE__*/_interopDefaultLegacy(React);
var styled__default = /*#__PURE__*/_interopDefaultLegacy(styled);
var ipa__default = /*#__PURE__*/_interopDefaultLegacy(ipa);

const Main = styled__default['default'].div `
  padding: 8px;
  width: 380px;
  border-radius: 4px;
  background-color: ${p => p.theme.general.altBg};
  box-shadow: ${p => p.theme.shadow.elevation1};
`;
const SearchWrapper = styled__default['default'].div `
  display: flex;
  flex-direction: row;
  margin-bottom: 6px;
`;
const SearchInput = styled__default['default'](ui.TextInput) `
  flex: 1 1 auto;
`;
const CharacterList = styled__default['default'].div `
  max-height: 260px;
  overflow: auto;
`;

const SearchResult = styled__default['default'].div `
  display: flex;
  flex-direction: row;
  align-items: center;
  cursor: default;

  background-color: ${p => p.theme.general.altBg};

  &:not(:last-child) {
    margin-bottom: 2px;
  }

  &:hover {
    background-color: ${p => p.theme.general.hoverAltBg};
  }
`;
const SearchResultChar = styled__default['default'].span `
  flex: none;
  margin-right: 8px;
  padding: 4px;
  min-width: 32px;
  text-align: center;
  font-size: 17pt;
`;
const SearchResultName = styled__default['default'].span `
  flex: 1 1 auto;
`;
const SecondaryTerms = styled__default['default'].span `
  opacity: 0.65;
`;
const NoSearchResults = styled__default['default'].div `
  margin: 24px;
  font-weight: bold;
  text-align: center;
`;
const NoResultsSuggestion = styled__default['default'].div `
  margin: 8px;
`;
const Match = 'b';

const highlightMatches = (term, query, cache, outerKey) => {
    // Terms and queries should never contain newlines. (Famous last words?)
    const cacheKey = `${term}\n${query}\n${outerKey}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }
    const termLower = term.toLowerCase();
    let result;
    // Fast path: if the term starts with the query, we don't have to do any
    // of the manual traversing of the term and keeping track of gaps and such.
    if (termLower.startsWith(query)) {
        result =
            React__default['default'].createElement(React.Fragment, { key: outerKey },
                React__default['default'].createElement(Match, null, term.substr(0, query.length)),
                term.substr(query.length));
    }
    else {
        // Slow path: walk termLower and query to find exactly which characters
        // match against each other. This is a partial reimplementation of the
        // search logic.
        result = [];
        // This is kind of sneaky, but the first character of the term and the
        // query are *assumed* to be the same. Currently they always are, but
        // if that changes, this code MUST be updated.
        let inMatch = true;
        let sectionStart = 0;
        for (let t = 0, q = 0; t < term.length; t++) {
            if (termLower[t] === query[q]) {
                q += 1;
                if (!inMatch) {
                    inMatch = true;
                    result.push(term.substring(sectionStart, t));
                    sectionStart = t;
                }
            }
            else if (inMatch) {
                inMatch = false;
                result.push(React__default['default'].createElement(Match, { key: result.length }, term.substring(sectionStart, t)));
                sectionStart = t;
            }
        }
        const remainder = term.substring(sectionStart);
        result.push(inMatch
            ? React__default['default'].createElement(Match, { key: result.length }, remainder)
            : remainder);
    }
    cache.set(cacheKey, result);
    return result;
};

const SearchResult$1 = (props) => {
    const { char, match, highlightCache } = props;
    const drawnMatches = new Set(match.terms
        .filter(t => char.input.startsWith(t.term))
        .map(t => t.term));
    const name = [];
    for (let i = 0; i < char.nameWords.length; i++) {
        if (i > 0) {
            name.push(' ');
        }
        const word = char.nameWords[i];
        const wordLower = word.toLowerCase();
        const wordMatch = match.terms.find(t => t.term === wordLower);
        if (wordMatch) {
            drawnMatches.add(wordMatch.term);
            name.push(highlightMatches(word, wordMatch.query, highlightCache, i));
        }
        else {
            name.push(word);
        }
    }
    const remainingTerms = match.terms.filter(t => !drawnMatches.has(t.term));
    return (React__default['default'].createElement(SearchResult, null,
        React__default['default'].createElement(SearchResultChar, null, char.display),
        React__default['default'].createElement(SearchResultName, null,
            name,
            remainingTerms.length > 0 &&
                React__default['default'].createElement(SecondaryTerms, null,
                    remainingTerms.map((t, index) => React__default['default'].createElement(React.Fragment, { key: index },
                        index == 0 ? ' (' : ' ',
                        highlightMatches(t.term, t.query, highlightCache))),
                    ')'))));
};

const NoSearchResults$1 = ({ query }) => React__default['default'].createElement(React__default['default'].Fragment, null,
    React__default['default'].createElement(NoSearchResults, null,
        "No matches for ",
        React__default['default'].createElement("i", null, query),
        "."),
    React__default['default'].createElement(NoResultsSuggestion, null, "Check your spelling or try a less specific query."));
const SearchResults = React__default['default'].memo((props) => {
    const { query } = props;
    const results = ipa__default['default'].search(query);
    const highlightCache = new Map();
    return (React__default['default'].createElement(React__default['default'].Fragment, null,
        results.length === 0 && React__default['default'].createElement(NoSearchResults$1, { query: query }),
        results.map(([char, match], index) => React__default['default'].createElement(SearchResult$1, { key: index, char: char, match: match, highlightCache: highlightCache }))));
});
SearchResults.displayName = 'SearchResults';

const Group = styled__default['default'].div.attrs({
    role: 'group',
}) `
  ${p => p.hasBase && styled.css `
    margin-left: 42px;
    text-indent: -42px;
  `}

  &:not(:first-child) {
    margin-top: ${p => p.hasBase ? '4px' : '8px'};
  }
`;
const GroupName = styled__default['default'].div `
  font-weight: bold;
  font-size: 11pt;
`;
const Character = styled__default['default'].span `
  display: inline-block;
  margin-right: 2px;
  margin-bottom: 2px;
  padding: 4px;
  min-width: 32px;
  text-indent: 0;
  text-align: center;
  font-size: 17pt;
  cursor: default;

  background-color: ${p => p.theme.general.altBg};
  font-weight: ${p => p.isBase && 'bold'};

  &:hover {
    background-color: ${p => p.theme.general.hoverAltBg};
  }
`;

const Character$1 = ({ char, isBase = false }) => React__default['default'].createElement(Character, { isBase: isBase, title: char.name }, char.display);
const CharacterListing = () => 
// FIXME: Render the array directly when TypeScript allows it
React__default['default'].createElement(React__default['default'].Fragment, null, ipa__default['default'].getGroups().map((group, index) => React__default['default'].createElement(Group, { key: index, hasBase: group.base !== null },
    group.base
        ? React__default['default'].createElement(Character$1, { isBase: true, char: group.base })
        : React__default['default'].createElement(GroupName, null, group.name),
    group.members.map((char, index) => React__default['default'].createElement(Character$1, { key: index, char: char })))));

const hasQuery = (q) => !/^\s*$/.test(q);
const IpaInput = () => {
    const [query, setQuery] = React.useState('');
    return (React__default['default'].createElement(Main, null,
        React__default['default'].createElement(SearchWrapper, null,
            React__default['default'].createElement(SearchInput, { minimal: true, value: query, placeholder: 'f, ng, alveolar sibilant, high tone, ...', onChange: e => setQuery(e.target.value) })),
        React__default['default'].createElement(CharacterList, null, hasQuery(query)
            ? React__default['default'].createElement(SearchResults, { query: query })
            : React__default['default'].createElement(CharacterListing, null))));
};

exports.IpaInput = IpaInput;
