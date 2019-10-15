import {UserInputError} from 'apollo-server';

import {TokenKind, tokenizePattern, normalizeStem} from '@condict/inflect';

import {
  InflectedFormId,
  InflectionTableRowInput,
  InflectedFormInput,
} from '../../graphql/types';

import {InflectionTableRowJson, InflectionTableCellJson} from './types';

export type TableLayoutResult = {
  finalLayout: InflectionTableRowJson[];
  stems: string[];
};

// Collects stem names that are present in an inflection pattern.
const collectStemNames = (pattern: string, stems: Set<string>) => {
  for (const tok of tokenizePattern(pattern)) {
    if (tok.kind === TokenKind.PLACEHOLDER) {
      const stem = normalizeStem(tok.stem);
      // ~ is a special stem that always refers to the lemma.
      if (stem !== '~') {
        stems.add(stem);
      }
    }
  }
};

const buildTableLayout = async (
  layout: InflectionTableRowInput[],
  handleInflectedForm: (form: InflectedFormInput) => Promise<InflectedFormId>
): Promise<TableLayoutResult> => {
  const finalLayout: InflectionTableRowJson[] = [];
  const stems = new Set<string>();

  const cellPromises: Promise<void>[] = [];
  outer: for (const row of layout) {
    const cells: InflectionTableCellJson[] = [];

    for (const cell of row.cells) {
      const layoutCell: InflectionTableCellJson = {};

      // It's rare for cells to span more than one column or row, so only
      // store the column and row span if necessary. Defaults to 1 otherwise.
      if (cell.columnSpan != null && cell.columnSpan > 1) {
        layoutCell.columnSpan = cell.columnSpan;
      }
      if (cell.rowSpan != null && cell.rowSpan > 1) {
        layoutCell.rowSpan = cell.rowSpan;
      }

      if (cell.headerText != null) {
        layoutCell.headerText = cell.headerText.trim();
      } else if (cell.inflectedForm != null) {
        // This is a data cell! Let handleInflectedForm() deal with it.
        // We expect it to return the inflected form ID.
        // All we do here is collect stem names, like `{Plural root}`,
        // inside the inflection pattern.
        collectStemNames(cell.inflectedForm.inflectionPattern, stems);
        cellPromises.push(
          handleInflectedForm(cell.inflectedForm).then(id => {
            layoutCell.inflectedFormId = id;
          })
        );
      } else {
        // We can't just throw an error here: if any existing cell promise is
        // rejected, we'll cause an unhandled promise rejection.
        cellPromises.push(
          Promise.reject(
            new UserInputError(
              `Cell must have either 'headerText' or 'inflectedForm'`
            )
          )
        );
        break outer;
      }

      cells.push(layoutCell);
    }

    finalLayout.push({cells});
  }

  await Promise.all(cellPromises);

  return {finalLayout, stems: Array.from(stems)};
};

export default buildTableLayout;
