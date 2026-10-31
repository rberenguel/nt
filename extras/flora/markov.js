/** Character-level Markov chain for pseudo-manuscript text. */

const DEFAULT_CORPUS = [
  `Universum quidem constare videtur ex elementis primis, quae motu perpetuo atque ordine quodam infinito per inane feruntur. Nihil enim ex nihilo gigni potest, neque rursus in nihilum resolvi ea quae semel orta sunt. Corpora autem partim sunt prima, partim ex primis composita. Quare oportet intellegere naturam rerum non subito mutari, sed certis gradibus ac legibus occultis progredi.`,
  `Soles et sidera, spatio immenso disiecta, suum quaeque cursum conficiunt lucemque ac calorem late diffundunt. Terra vero in medio defixa, nubibus et ventis circumdata, animantium genera fovet variaque frugum semina nutrit. Mare quoque profundum tempestatibus agitur, undis litora tundens, nec tamen fines praestitutos transcendit. Haec omnia rationi humanae admirabilia parent, dum mens ipsa veritatem investigare conatur.`,
  `Sensus autem nostri speciem quandam rerum externarum ad animum referunt, quamvis saepe fallaces sint si sine iudicio mentis accipiantur. Visus enim distantiam et magnitudinem fallit, auditus sonos leviter mutatos transmittit. Itaque mens sola, collatis causis et experimentis repetitis, discernit inter falsa atque vera, donec certam quandam regulam sapientiae assequatur.`,
  "Omnis disciplina rationem habet fundamenta sua iaciendi antequam altiora aedificia exstruantur.",
  "In architectura quidem oportet situm caeli, flatum ventorum, et aquarum salubritatem diligenter explorare.",
  "Si enim muri solidis fundamentis non nitantur, ruina mox sequitur, quantumvis ornamenta picturaeque externae oculos intuentium decipiant.",
  "Lapis caesus, calx viva, et harena fluvialis apta proportione mixta durabilem materiam efficiunt, quae saeculorum iniurias tempestatesque sustinere valet.",
  "Agricolae quoque sua cura suaque tempora servant.",
  "Vere novo terra glebis solutis aperitur, vomere sulcis altis ductis, ut semen fovendum recipiat.",
  "Aestate messes maturescunt, aristis auro fulgentibus, dum falces curvatae culmos secant et manipulos in areas colligunt.",
  "Autumno uvae prelo premuntur, mustum in dolia diffunditur, frugumque proventus in horreis ad hiemem reponitur.",
  "Nihil sine labore humano terra sponte reddit, nisi forte herbas inutiles spinasque acutas quae segetes laedunt.",
  "In civitatibus vero concordia civium summum bonum habetur.",
  "Leges a maioribus constitutae custodiunt iura singulorum, ne potentiores tenuiores opprimant.",
  "Magistratus officio suo funguntur cum aequitate, poenis sontibus impositis et praemiis probis distributis.",
  "Mercatores per maria et terras iter faciunt, merces exoticas, vestes sericas, aromata orientis, metallaque pretiosa invecturi.",
  "Ita commercio mutuo gentes disiunctae iunguntur, dum linguae et mores diversi inter se commutantur.",
  "Flumina e montibus altis scaturiunt, cursu per valles deflectente, donec aequori immenso sese immittant.",
  "Aquae puritas primis fontibus inest, sed per terram lutumque fluens varias tincturas accipit.",
  "Venti quoque, modo lenes et recreantes, modo furentes et silvas prosternentes, aere concitato moventur.",
  "Omnia haec motu continuo agitantur, nec quidquam in universo penitus immobile manet.",
  "Ipsum caelum volvitur, siderumque choreas per noctem ducit, lucis ac tenebrarum vices perpetuas mortalibus demonstrans."
];

export function buildModel(texts = DEFAULT_CORPUS, order = 4) {
  const model = {};
  for (const text of texts) {
    const padded = ' '.repeat(order) + text + ' '.repeat(order);
    for (let i = 0; i < text.length; i++) {
      const key = padded.slice(i, i + order);
      const next = padded[i + order];
      if (!model[key]) model[key] = {};
      model[key][next] = (model[key][next] || 0) + 1;
    }
  }
  return model;
}

function normalise(w) {
  return w.toLowerCase().replace(/[.,;:!?]+$/, '');
}

function lastWords(out, n) {
  return out.trim().split(/\s+/).map(normalise).filter(Boolean).slice(-n);
}

function isValidWord(out, wordWithPunct) {
  const w = normalise(wordWithPunct);
  if (!w) return true;
  const recent = lastWords(out, 3);
  return !recent.includes(w);
}

export function generate(model, order, length, rng, mode = 'sentence') {
  const isTitle = mode === 'title';
  let out = '';
  let currentWord = '';
  let attempts = 0;
  const maxAttempts = length * 16;

  while (out.length < length && attempts < maxAttempts) {
    attempts++;
    const key = (' '.repeat(order) + out + currentWord).slice(-order);
    const choices = model[key];
    if (!choices) break;

    const entries = Object.entries(choices);
    if (!entries.length) break;

    const total = entries.reduce((sum, [, c]) => sum + c, 0);
    let r = (rng ? rng() : Math.random()) * total;
    let next = ' ';
    for (const [ch, count] of entries) {
      r -= count;
      if (r <= 0) { next = ch; break; }
    }

    // Title mode: turn punctuation into a word boundary without emitting it.
    if (isTitle && '.,;:!?'.includes(next)) {
      next = ' ';
    }

    // Punctuation sanity for sentence/rubric mode.
    if (!isTitle) {
      if (next === '.' && out.endsWith(',')) continue;
      if (next === ',' && out.endsWith(',')) continue;
    }

    const isPunct = /[.,;:!?]/.test(next);
    if (next === ' ' || isPunct) {
      const word = currentWord + (isPunct ? next : '');
      if (currentWord && !isValidWord(out, word)) {
        currentWord = '';
        continue;
      }
      out += word;
      if (next === ' ') out += ' ';
      currentWord = '';
    } else {
      currentWord += next;
    }
  }

  return out.trim();
}

const globalModel = buildModel();

export function paragraph(rng, length = 180) {
  return generate(globalModel, 4, length, () => rng.next ? rng.next() : rng(), 'sentence');
}

export function sentence(rng, length = 60) {
  return generate(globalModel, 4, length, () => rng.next ? rng.next() : rng(), 'sentence');
}

export function title(rng, length = 24) {
  return generate(globalModel, 4, length, () => rng.next ? rng.next() : rng(), 'title');
}

export function rubric(rng, length = 30) {
  return generate(globalModel, 4, length, () => rng.next ? rng.next() : rng(), 'sentence');
}
