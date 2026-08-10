/**
 * Frases de referencia para el backstop determinístico de escalada (ver
 * specs/problema-escalamiento-bloque5.md). Se embeben una sola vez al
 * arrancar el proceso (RedFlagDetectorService) y se comparan por similitud
 * coseno contra el mensaje del paciente en cada turno.
 *
 * Es `.ts` y no `.md`: el Dockerfile de apps/api solo copia `dist/` y
 * `src/database` al runtime, así que un archivo de datos en otra carpeta no
 * llegaría a producción sin tocar el Dockerfile.
 */
export const RED_FLAG_PHRASES: string[] = [
  // Sangrado
  'Tengo sangrado muy fuerte por la herida.',
  'La herida no para de sangrar.',
  'Estoy sangrando mucho.',

  // Dificultad para respirar
  'Me cuesta mucho respirar.',
  'No puedo respirar bien.',
  'Siento que me ahogo.',

  // Fiebre alta
  'Tengo fiebre muy alta.',
  'Tengo mucha fiebre y escalofríos fuertes.',

  // Dolor severo / signos de infección
  'Tengo un dolor insoportable.',
  'El dolor es muchísimo más fuerte que antes.',
  'La herida está muy roja, caliente e hinchada.',
  'Me está saliendo pus de la herida.',

  // Petición explícita de hablar con un médico humano
  'Necesito hablar con un médico humano ya mismo.',
  'Quiero hablar con un médico humano.',
  'Necesito que me remitan con un doctor de verdad.',
];
