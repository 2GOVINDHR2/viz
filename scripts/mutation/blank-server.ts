/** Mutant of react-dom/server for the unit-suite audit (ADR-054): every server render is an empty screen. */
export const renderToStaticMarkup = (): string => '<main></main>';
export const renderToString = renderToStaticMarkup;
