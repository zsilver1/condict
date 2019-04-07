import MultiMap from '../../utils/multi-map';
import {BlockElementInput} from '../../rich-text/types';
import {validateDescription} from '../../rich-text/validate';

import Mutator from '../mutator';
import FieldSet from '../field-set';
import {validateTerm} from '../lemma/validators';

import {
  DefinitionRow,
  NewDefinitionInput,
  EditDefinitionInput,
  DefinitionInflectionTableInput,
} from './types';
import DefinitionStemMut from './stem-mut';
import DefinitionInflectionTableMut, {DefinitionData} from './table-mut';
import CustomFormMut from './custom-form-mut';
import DefinitionTagMut from './tag-mut';
import DerivedDefinitionMut from './derived-mut';

class DefinitionMut extends Mutator {
  public async insert({
    languageId,
    term,
    partOfSpeechId,
    description,
    stems,
    inflectionTables,
    tags,
  }: NewDefinitionInput): Promise<DefinitionRow> {
    const {db} = this;
    const {Language, Definition, PartOfSpeech} = this.model;
    const {
      LemmaMut,
      DefinitionDescriptionMut,
      DefinitionStemMut,
      DefinitionTagMut,
      DerivedDefinitionMut,
    } = this.mut;

    const language = await Language.byIdRequired(+languageId, 'languageId');
    const partOfSpeech = await PartOfSpeech.byIdRequired(
      +partOfSpeechId,
      'partOfSpeechId'
    );
    const validTerm = validateTerm(term);

    return db.transact(async () => {
      const lemmaId = await LemmaMut.ensureExists(language.id, validTerm);

      const {insertId: definitionId} = await db.exec`
        insert into definitions (lemma_id, language_id, part_of_speech_id)
        values (${lemmaId}, ${language.id}, ${partOfSpeech.id})
      `;
      await DefinitionDescriptionMut.insert(definitionId, description);
      const stemMap = await DefinitionStemMut.insert(definitionId, stems);

      const derivedDefinitions = await this.updateInflectionTables(
        definitionId,
        partOfSpeech.id,
        term,
        stemMap,
        inflectionTables,
        true
      );

      await DefinitionTagMut.insertAll(
        definitionId,
        tags
      );

      await DerivedDefinitionMut.insertAll(
        language.id,
        definitionId,
        derivedDefinitions
      );

      return Definition.byIdRequired(definitionId);
    });
  }

  public async update(id: number, {
    term,
    partOfSpeechId,
    description,
    stems,
    inflectionTables,
    tags,
  }: EditDefinitionInput): Promise<DefinitionRow> {
    const {db} = this;
    const {Definition} = this.model;
    const {
      LemmaMut,
      DefinitionStemMut,
      DefinitionDescriptionMut,
      DefinitionTagMut,
    } = this.mut;

    const definition = await Definition.byIdRequired(id);

    return db.transact(async () => {
      const newFields = new FieldSet<DefinitionRow>();

      const actualTerm = await this.updateTerm(definition, term, newFields);
      const actualPartOfSpeechId = await this.updatePartOfSpeech(
        definition,
        partOfSpeechId,
        newFields
      );
      // If the part of speech is changed, we can't keep the old inflection
      // tables, since they belong to the wrong part of speech. If no new
      // tables were provided, delete the old ones.
      if (
        actualPartOfSpeechId !== definition.part_of_speech_id &&
        inflectionTables == null
      ) {
        inflectionTables = [];
      }

      if (newFields.hasValues) {
        await db.exec`
          update definitions
          set ${newFields}
          where id = ${definition.id}
        `;
      }

      if (description) {
        await DefinitionDescriptionMut.update(definition.id, description);
      }

      const stemMap = await DefinitionStemMut.update(definition.id, stems);

      await this.updateInflectionTablesAndForms(
        definition,
        actualPartOfSpeechId,
        actualTerm,
        stemMap,
        inflectionTables,
        // If the term or stems have changed, we have to rederive all forms
        // for this definition.
        term !== definition.term || stems != null
      );

      if (tags) {
        await DefinitionTagMut.update(definition.id, tags);
      }

      // If the derived definitions or term have changed, we may have orphaned
      // one or more lemmas, so we have to delete them too.
      await LemmaMut.deleteEmpty(definition.language_id);

      db.clearCache(Definition.byIdKey, definition.id);
      return Definition.byIdRequired(definition.id);
    });
  }

  private async updateTerm(
    definition: DefinitionRow,
    term: string | undefined | null,
    newFields: FieldSet<DefinitionRow>
  ): Promise<string> {
    const {LemmaMut} = this.mut;

    if (term != null && term !== definition.term) {
      const validTerm = validateTerm(term);
      const newLemmaId = await LemmaMut.ensureExists(
        definition.language_id,
        validTerm
      );
      newFields.set('lemma_id', newLemmaId);
      return validTerm.value;
    } else {
      return definition.term;
    }
  }

  private async updatePartOfSpeech(
    definition: DefinitionRow,
    partOfSpeechId: string | undefined | null,
    newFields: FieldSet<DefinitionRow>
  ): Promise<number> {
    const {PartOfSpeech} = this.model;

    if (
      partOfSpeechId != null &&
      +partOfSpeechId !== definition.part_of_speech_id
    ) {
      const partOfSpeech = await PartOfSpeech.byIdRequired(
        +partOfSpeechId,
        'partOfSpeechId'
      );

      newFields.set('part_of_speech_id', partOfSpeech.id);
      return partOfSpeech.id;
    } else {
      return definition.part_of_speech_id;
    }
  }

  public async delete(id: number): Promise<boolean> {
    const {Definition} = this.model;
    const {LemmaMut} = this.mut;

    // We need the language ID
    const definition = await Definition.byId(id);
    if (!definition) {
      return false;
    }

    await this.db.exec`
      delete from definitions
      where id = ${id}
    `;
    await LemmaMut.deleteEmpty(definition.language_id);
    return true;
  }

  private async updateInflectionTablesAndForms(
    definition: DefinitionRow,
    partOfSpeechId: number,
    term: string,
    stemMap: Map<string, string>,
    inflectionTables: DefinitionInflectionTableInput[] | undefined | null,
    newFormsNeeded: boolean
  ): Promise<void> {
    const {DerivedDefinitionMut} = this.mut;

    let derivedDefinitions: MultiMap<string, number> | null = null;
    if (inflectionTables) {
      derivedDefinitions = await this.updateInflectionTables(
        definition.id,
        partOfSpeechId,
        term,
        stemMap,
        inflectionTables,
        false
      );
    } else if (newFormsNeeded) {
      derivedDefinitions = await this.rederiveAllForms(
        definition.id,
        term,
        stemMap
      );
    }

    if (derivedDefinitions) {
      await DerivedDefinitionMut.deleteAll(definition.id);
      await DerivedDefinitionMut.insertAll(
        definition.language_id,
        definition.id,
        derivedDefinitions
      );
    }
  }

  private async updateInflectionTables(
    definitionId: number,
    partOfSpeechId: number,
    term: string,
    stemMap: Map<string, string>,
    inflectionTables: DefinitionInflectionTableInput[],
    isNewDefinition: boolean
  ): Promise<MultiMap<string, number>> {
    const {DefinitionInflectionTableMut} = this.mut;

    const derivedDefinitions = new MultiMap<string, number>();

    const definitionData: DefinitionData = {
      id: definitionId,
      term,
      stemMap,
      partOfSpeechId,
    };

    const currentTableIds: number[] = [];
    for (const table of inflectionTables) {
      interface Result {
        id: number;
        derivedForms: Map<number, string>;
      }
      const {id: tableId, derivedForms}: Result = await (
        table.id != null && !isNewDefinition
          ? DefinitionInflectionTableMut.update(
            +table.id,
            definitionData,
            table,
            currentTableIds.length
          )
          : DefinitionInflectionTableMut.insert(
            definitionData,
            table,
            currentTableIds.length
          )
      );

      // Add each form as a derived definition. So derivative.
      derivedForms.forEach((term, formId) =>
        derivedDefinitions.add(term, formId)
      );

      currentTableIds.push(tableId);
    }

    if (!isNewDefinition) {
      await DefinitionInflectionTableMut.deleteOld(
        definitionId,
        currentTableIds
      );
    }

    return derivedDefinitions;
  }

  private async rederiveAllForms(
    definitionId: number,
    term: string,
    stemMap: Map<string, string>
  ): Promise<MultiMap<string, number>> {
    interface Row {
      id: number;
      inflection_table_id: number;
    }

    const {db} = this;
    const {DefinitionInflectionTableMut} = this.mut;

    const derivedDefinitions = new MultiMap<string, number>();

    const definitionTables = await db.all<Row>`
      select id, inflection_table_id
      from definition_inflection_tables
      where definition_id = ${definitionId}
    `;
    const customForms = await this.fetchAllCustomForms(
      definitionTables.map(t => t.id)
    );

    for (const table of definitionTables) {
      const derivedForms = await DefinitionInflectionTableMut.deriveAllForms(
        table.id,
        term,
        stemMap,
        table.inflection_table_id,
        customForms.get(table.id) || new Map()
      );

      // Add each form as a derived definition. So derivative.
      derivedForms.forEach((term, formId) =>
        derivedDefinitions.add(term, formId)
      );
    }

    return derivedDefinitions;
  }

  private async fetchAllCustomForms(
    definitionTableIds: number[]
  ): Promise<Map<number, Map<number, string>>> {
    interface Row {
      parent_id: number;
      inflected_form_id: number;
      value: string;
    }

    const {db} = this;

    const allCustomForms = await db.all<Row>`
      select
        df.definition_inflection_table_id as parent_id,
        df.inflected_form_id,
        df.inflected_form as value
      from definition_forms df
      inner join definition_inflection_tables dit
        on dit.id = df.definition_inflection_table_id
      where df.definition_inflection_table_id in (${definitionTableIds})
    `;

    return allCustomForms.reduce((map, row) => {
      let forms = map.get(row.parent_id);
      if (!forms) {
        forms = new Map();
        map.set(row.parent_id, forms);
      }
      forms.set(row.inflected_form_id, row.value);
      return map;
    }, new Map<number, Map<number, string>>());
  }
}

class DefinitionDescriptionMut extends Mutator {
  public async insert(
    definitionId: number,
    description: BlockElementInput[]
  ): Promise<void> {
    const finalDescription = validateDescription(description, () => {});

    await this.db.exec`
      insert into definition_descriptions (definition_id, description)
      values (${definitionId}, ${JSON.stringify(finalDescription)})
    `;
  }

  public async update(
    definitionId: number,
    description: BlockElementInput[]
  ): Promise<void> {
    const finalDescription = validateDescription(description, () => {});

    await this.db.exec`
      update definition_descriptions
      set description = ${JSON.stringify(finalDescription)}
      where definition_id = ${definitionId}
    `;
  }
}

export default {
  DefinitionMut,
  DefinitionStemMut,
  DefinitionDescriptionMut,
  DefinitionInflectionTableMut,
  DefinitionTagMut,
  DerivedDefinitionMut,
  CustomFormMut,
};
