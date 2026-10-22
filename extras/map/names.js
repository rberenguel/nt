// Procedural Fantasy Cartography — Consistent Linguistic Name Families Engine
// Features 5 large, culturally cohesive name buckets with 50+ unique settlements each:
// 1. Imperial Latin (Classical cartography: Portus, Castellum, Mons, Vallis, Augusta)
// 2. Anglo-Norse / Fantasy Shires (Old English & Norse: -haven, -ford, -bury, -gate, -mere, -keep)
// 3. Book of the New Sun (Gene Wolfe: Nessus, Thrax, Saltus, Matachin, Volex, Piteas)
// 4. Celtic & Brythonic (Gaelic & Welsh: Caer, Aber, Dun, Bryn, Llan, Tre, Glen, Inver)
// 5. Romance & Chivalric (Occitan & Old French: Pont-le-Roi, Val d'Or, Beauvallon, Rochebrune)

const NAME_FAMILIES = [
  {
    id: "imperial_latin",
    name: "Imperial Latin",
    realmTitles: [
      "IMPERIUM SOLIS",
      "REGNUM BOREALE",
      "TERRITORIUM AUREUM",
      "PROVINCIA LUNARIS",
      "CONCORDIA ANTIQUA",
      "CORONA SEPTENTRIONALIS",
      "ARCHIDUCATUS AQUILAE",
      "PRAEFECTURA AUSTRALIS",
      "PRINCIPATUS STELLAE",
      "REGIO VETERIS FIDEI",
      "LATIUM NOBILISSIMUM",
      "IMPERIUM OCCIDENTALE",
    ],
    subtitles: [
      "Ex Tabulis Antiquis et Typis Academiae Expressa",
      "Omnes Vias Montes ac Sylvarum Ambitus Repraesentans",
      "Singulari Studio ac Labore in Lucem Aedita",
      "Accurata Descriptio Chorographica",
      "Ubi Singulorum Montium et Amnium Facies Exprimitur",
      "Tabulis Aeneis Expressa et In Usus Eruditorum Explicata",
    ],
    wildernessTitles: [
      "DESERTA MAGNA",
      "VASTITAS INTERIOR",
      "CAMPI SOLITUDINIS",
      "PLANITIES IMMENSA",
      "TERRA INCOGNITA",
      "REGIO TENEBROSA",
      "DESOLATIO ORIENTALIS",
      "HIC ABUNDANT LEONES",
      "DESERTUM ARIDUM",
      "VASTITAS BOREALIS",
      "SALTUS SILVESTRIS",
      "SOLITUDO AUREA",
    ],
    settlements: [
      "Portus Lunae", "Castellum Umbrae", "Novum Castrum", "Mons Solaris",
      "Arx Aquilae", "Vallis Aurea", "Turris Stellae", "Portus Aureus",
      "Astraea", "Caelestis", "Mons Silvarum", "Castra Fluvii",
      "Forum Neronis", "Augusta Lucis", "Aquae Calidae", "Arx Fidei",
      "Pontus Magnus", "Vallis Vespera", "Turris Alba", "Castellum Frigoris",
      "Portus Meridies", "Silva Vetus", "Mons Ferreus", "Nova Caesarea",
      "Arx Tenebrosa", "Fons Vivus", "Vicus Marinus", "Castra Nova",
      "Luceria", "Segusio", "Brundisium", "Tarraco",
      "Emerita", "Lugdunum", "Salona", "Aquileia",
      "Ravenna", "Mediolanum", "Volaterrae", "Arretium",
      "Interamna", "Syracusae", "Panormus", "Ariminum",
      "Spoletium", "Beneventum", "Capua", "Puteoli",
      "Tarentum", "Rhegium", "Volsinii", "Falerii"
    ],
  },
  {
    id: "anglo_norse",
    name: "Anglo-Norse & Fantasy Shires",
    realmTitles: [
      "THE NORTHERN MARCHES",
      "THE REALM OF ELDEN",
      "THE SHIRES OF DUNBARROW",
      "HIGHLAND REACH",
      "THE WESTERN FELLS",
      "THE VALES OF OAKHAVEN",
      "THE IRON DOMINION",
      "THE CROWN OF WHITESTONE",
      "THE WINDWARD COAST",
      "THE MARCHES OF ELDERMERE",
      "THE LOWLAND HUNDREDS",
      "THE SEVEN PEAKS",
    ],
    subtitles: [
      "Being a True Chorographical Survey of the Shires",
      "Wherein are Set Forth All High Roades, Waters and Woods",
      "Engraved on Copper Plate for the King's Highway",
      "With the Bounds of Every Hundred and Wapentake",
      "Drawn from Divers Ancient Parchments and Surveys",
      "Faithfully Delineated for the Safety of Wayfarers",
    ],
    wildernessTitles: [
      "THE GREAT BARRENS",
      "THE CROWLANDS",
      "THE DUSK FELLS",
      "THE SUNKEN HEATH",
      "THE LONELY DOWN",
      "DEAD MEN'S REACH",
      "THE ASHEN WASTE",
      "WOLFSBANE SHIRE",
      "THE BLEAK STEPS",
      "COLD HARBOR MOOR",
      "THE HOLLOW CRAGS",
      "THE FORGOTTEN REACH",
    ],
    settlements: [
      "Oakhaven", "Marrowgate", "Aldenford", "Grimsbury",
      "Dunbarrow", "Silverkeep", "Highwater", "Ironhaven",
      "Kestrel's Watch", "Eldermere", "Whitestone", "Crow's Nest",
      "Ravenfall", "Barrowford", "Stonehaven", "Blackwood",
      "Thornbury", "Wolfsdale", "Fellwater", "Ashford",
      "Stormwatch", "Winterfell", "Coldharbor", "Gallows Hill",
      "Bridgewater", "Millhaven", "Cragmoor", "Hedgebrook",
      "Lockwood", "Redmire", "Hallowell", "Rookwood",
      "Brackendale", "Westwick", "Northmere", "Swanhaven",
      "Emberfell", "Driftwood", "Fairhaven", "Kingsford",
      "Deepwater", "Ironwood", "Greyfell", "Oakhill",
      "Foxglove", "Broadwater", "Silverdale", "Frostpeak",
      "Wellspring", "Holmwood", "Crossways", "Brambly"
    ],
  },
  {
    id: "book_of_the_new_sun",
    name: "Book of the New Sun (Urth)",
    realmTitles: [
      "THE COMMONWEALTH OF URTH",
      "THE AUTARCHY OF NESSUS",
      "THE REACH OF THE GYOLL",
      "THE HOUSES OF THRAX",
      "THE SALTUS AND THE PAMPA",
      "DOMINION OF THE CACOGENS",
      "THE DESOLATION OF PITEAS",
      "THE VESPERAL PROVINCES",
      "THE HIERATIC SEATS",
      "THE SEATS OF THE CHILARCH",
      "THE SHORES OF THE VERMEIL SEA",
      "THE INCREATE REALM",
    ],
    subtitles: [
      "Transcribed from the Archives of the Citadel",
      "As Chronicled in the Book of the New Sun",
      "Delineating the Redoubts, Pavements and Necropolises",
      "Wherein the Seven Paces of the Hierodules are Recorded",
      "From the Porphyry Gate unto the Mountain Castles",
      "Illuminated Under the Red Rays of the Dying Sun",
    ],
    wildernessTitles: [
      "THE PAMPA IMMENSA",
      "DESOLATIO PITEAS",
      "THE ASHES OF URTH",
      "SALTUS SILVESTRIS",
      "THE SEPULCHRAL REACH",
      "VASTITAS CHTHONICA",
      "THE BOTANIC RUINS",
      "CAMPI SANGUINIS",
      "THE SEAT OF TYPHON",
      "CHASM OF THE CACAGENS",
      "THE EBON VAST",
      "THE MORIBUND PLAIN",
    ],
    settlements: [
      "Nessus", "Thrax", "Saltus", "Volex",
      "Phaedrus", "Alverna", "Matachin", "Tyana",
      "Rhyncolis", "Piteas", "Vincula", "Cenotaph",
      "Ossuary", "Labyrinth", "Ziggurat", "Redoubt",
      "Hagios", "Baldanders", "Thecla", "Apheta",
      "Severian", "Dorcas", "Jolenta", "Agia",
      "Hethor", "Vodalus", "Terminus", "Orchidarium",
      "Cacogen", "Urthgard", "Apu-Punchau", "Typhon",
      "Sanguinary", "Moribund", "Hierodule", "Chthonos",
      "Subluna", "Vespera", "Sepulchra", "Fuligo",
      "Hydrargyrum", "Crux", "Palanquin", "Orixa",
      "Epopt", "Ancon", "Caloyer", "Murena",
      "Domnina", "Cyriaca", "Palaemon", "Ultan"
    ],
  },
  {
    id: "celtic_brythonic",
    name: "Celtic & Brythonic",
    realmTitles: [
      "THE KINGDOM OF GWYNEDD",
      "THE MARCHES OF MORWEN",
      "THE DUCHY OF ABERDYFI",
      "THE ISLES OF AVALON",
      "THE SEVEN CAIRNS",
      "THE REALM OF TIR-NAN-OG",
      "THE MISTY GLENS OF MORAY",
      "THE DOMINION OF DALRIADA",
      "THE CELTIC EMBAYMENTS",
      "THE PRINCIPALITY OF POWYS",
      "THE REACH OF BROCELIANDE",
      "THE VALES OF CAMBRIA",
    ],
    subtitles: [
      "From the Ancient Charts of the High Bards",
      "Showing the Forts, Cromlechs and Sacred Waters",
      "Drawn at the Moot of the Seven Kings",
      "A True Map of the Western Ridges and Straths",
      "Engraved by Order of the Archdruids of Mona",
      "Preserved in the Abbey of the White Island",
    ],
    wildernessTitles: [
      "THE HAUNTED STRATH",
      "THE PEAT WASTES",
      "THE MISTY CAIRNS",
      "THE BARREN GLEN",
      "THE GREY FELLS",
      "TIR-NAN-OG DESOLATION",
      "THE SHADOW MOOR",
      "THE DRIFTING FENS",
      "THE SILENT MOUNDS",
      "THE WINDSWEPT TOR",
      "THE BOG OF BROCELIANDE",
      "THE WILD STRATH",
    ],
    settlements: [
      "Caer Morwen", "Aberdyfi", "Dun Eidyn", "Bryn Mawr",
      "Llanfair", "Trevallyn", "Glencree", "Invergarry",
      "Kilmore", "Caerleon", "Dundrum", "Aberdeen",
      "Ballymore", "Cardigan", "Eilean Donan", "Glendalough",
      "Inverness", "Kilmarnock", "Llangollen", "Monmouth",
      "Nantwich", "Penrith", "Roslin", "Strathaven",
      "Tintagel", "Tredegar", "Usk", "Ystrad",
      "Caernarfon", "Dunseverick", "Fingal", "Glengarry",
      "Holyhead", "Iona", "Killarney", "Llandudno",
      "Mull", "Newgrange", "Oban", "Portree",
      "Rathlin", "Skye", "Talla", "Ullapool",
      "Wicklow", "Braemar" ,"Conwy", "Dunbar",
      "Elgol", "Fintry", "Gairloch", "Harlech"
    ],
  },
  {
    id: "romance_chivalric",
    name: "Romance & Chivalric",
    realmTitles: [
      "ROYAUME DE VAL-D'OR",
      "COMTÉ DE BEAUVALLON",
      "TERRES D'OCCITANIE",
      "SEIGNEURIE DE MONT-D'OR",
      "MARQUISAT DE PONT-LE-ROI",
      "LE PAYS DE CASTEL-MIROIR",
      "DUCHÉ DE HAUTE-RIVE",
      "LES MARCHES DE CLAIRVAUX",
      "DOMAINE DES SEPT VALLÉES",
      "PRINCIPAUTÉ DE LA MER VERMEILLE",
      "CHAMPAGNE OCCIDENTALE",
      "BARONNIE DE ROCHEBRUNE",
    ],
    subtitles: [
      "Dressée par Ordre du Roy en son Conseil",
      "Contenant Toutes les Villes, Ponts et Châteaux",
      "Gravée en Taille-Douce par les Géographes du Roy",
      "Pour l'Utilité des Voyageurs et Gentilshommes",
      "Dédiée aux Seigneurs et Pairs de la Province",
      "Revue et Corrigée sur les Lieux par Maistre Chanoine",
    ],
    wildernessTitles: [
      "LES LANDES SAUVAGES",
      "LE DÉSERT DE PIERRE",
      "LES TERRES GASTES",
      "LA FORÊT MAUDITE",
      "LE HAUT PLATEAU",
      "LES GORGES NOIRES",
      "LE PAYS D'OMBRE",
      "LES COLLINES PERDUES",
      "LE GRAND MARAIS",
      "LES VALLÉES MORTES",
      "LA PLAINE ARIDE",
      "LES ROCHES FAROUCHES",
    ],
    settlements: [
      "Pont-le-Roi", "Val d'Or", "Beauvallon", "Mont-d'Or",
      "Château-Neuf", "Port-Méridien", "Roc-de-Fer", "Castel-Miroir",
      "Clairvaux", "Haut-Rocher", "Belle-Isle", "Saint-Malo",
      "Rochebrune", "Val-de-Loup", "Beaupré", "Aigues-Mortes",
      "Fontaine-Bleue", "Granville", "Hautefort", "Josselin",
      "Langeais", "Neuville", "Olonne", "Peyrepertuse",
      "Quéribus", "Rocamadour", "Sarlat", "Tournon",
      "Villard", "Beaumont", "Castelnau", "Dinan",
      "Eze", "Fouras", "Gaillard", "Honfleur",
      "Issigeac", "Jarnac", "Loches", "Mirepoix",
      "Noirmoutier", "Périgueux", "Ribeauvillé", "Saint-Emilion",
      "Vence", "Pierrefonds", "Bonneval", "Argenton",
      "Castelmoron", "Mirande", "Florac", "Aubeterre"
    ],
  },
];

/**
 * Returns the deterministic Name Family for a given map seed.
 */
function getNameFamily(seed) {
  const idx = Math.abs(seed) % NAME_FAMILIES.length;
  return NAME_FAMILIES[idx];
}

/**
 * Stateful Name Bucket for a single map generation.
 * Ensures consistent linguistic culture across Cartouche, Settlements, and Wilderness,
 * with no duplicate settlement names.
 */
class NameBucket {
  constructor(seed) {
    this.seed = seed;
    this.family = getNameFamily(seed);
    this.rng = createRNG(seed ^ 0x5bd1e995);

    // Shuffle settlements so selection is randomized per seed
    this.availableSettlements = [...this.family.settlements];
    for (let i = this.availableSettlements.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const tmp = this.availableSettlements[i];
      this.availableSettlements[i] = this.availableSettlements[j];
      this.availableSettlements[j] = tmp;
    }

    this.drawnSettlements = new Set();
    this.drawnWilderness = new Set();
  }

  getSettlementName() {
    for (let n of this.availableSettlements) {
      if (!this.drawnSettlements.has(n)) {
        this.drawnSettlements.add(n);
        return n;
      }
    }
    // Fallback if ever exhausted
    return this.family.settlements[0];
  }

  getRealmTitle() {
    const titles = this.family.realmTitles;
    return titles[Math.floor(this.rng() * titles.length)];
  }

  getSubtitle() {
    const subs = this.family.subtitles;
    return subs[Math.floor(this.rng() * subs.length)];
  }

  getWildernessTitle() {
    const wTitles = this.family.wildernessTitles;
    for (let i = 0; i < wTitles.length; i++) {
      const t = wTitles[Math.floor(this.rng() * wTitles.length)];
      if (!this.drawnWilderness.has(t)) {
        this.drawnWilderness.add(t);
        return t;
      }
    }
    return wTitles[0];
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { NAME_FAMILIES, getNameFamily, NameBucket };
}
