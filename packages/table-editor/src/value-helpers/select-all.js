import Selection from '../value/selection';

export default value => {
  const {layout} = value;
  const firstCell = layout.cellFromPosition(0, 0);
  const lastCell = layout.cellFromPosition(
    layout.rowCount - 1,
    layout.colCount - 1
  );

  return value.withSelection(new Selection(
    layout,
    lastCell.key,
    firstCell.key
  ));
};