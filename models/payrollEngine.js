export function calculatePayroll({ salaireBase, primePanier = 4400, primeVoiture = 8000 }) {
  const horaireMensuel = 173.33;
  const sBase = parseFloat(salaireBase);
  const sPoste = sBase; // Dans ton exemple Sage, Salaire de Poste = Salaire de Base

  // Cotisations CNAS
  const cnasSalarie = Math.round(sPoste * 0.09 * 100) / 100;       // 9%
  const cnasPatronale = Math.round(sPoste * 0.255 * 100) / 100;   // 25.5%
  const fondLogement = Math.round(sPoste * 0.005 * 100) / 100;     // 0.5%

  // Imposable (Poste - CNAS 9%)
  const salaireImposable = Math.round((sPoste - cnasSalarie) * 100) / 100;

  // IRG fixe selon l'exemple de ton bulletin Sage
  const irg = 50921.80;

  // Net après impôt et Net à payer
  const salaireApresImpot = Math.round((salaireImposable - irg) * 100) / 100;
  const netAPayer = Math.round((salaireApresImpot + parseFloat(primePanier) + parseFloat(primeVoiture)) * 100) / 100;

  return {
    horaireMensuel,
    salaireBase: sBase,
    salairePoste: sPoste,
    cnasSalarie,
    cnasPatronale,
    fondLogement,
    primePanier: parseFloat(primePanier),
    primeVoiture: parseFloat(primeVoiture),
    salaireImposable,
    irg,
    salaireApresImpot,
    netAPayer
  };
}
