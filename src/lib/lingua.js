import { getLocales } from 'expo-localization';

// A língua do telemóvel (expo-localization): um turista com o telemóvel em inglês, francês ou alemão vê o
// menu da página do restaurante logo em inglês, sem ter de procurar o botão "English".

/** O código da primeira língua do telemóvel ("pt", "en", "fr"…). Se não for possível saber, "pt". */
export function linguaDoTelemovel() {
  try {
    return getLocales()[0]?.languageCode ?? 'pt';
  } catch {
    return 'pt';
  }
}

/** true se o telemóvel estiver em português (o menu fica em português). */
export function telemovelEmPortugues() {
  return linguaDoTelemovel() === 'pt';
}
