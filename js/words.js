const WORDS = {
    "Zawody": [
        ["lekarz", "pielęgniarka"],
        ["nauczyciel", "wykładowca"],
        ["programista", "analityk"],
        ["kucharz", "kelner"],
        ["pilot", "stewardessa"],
        ["policjant", "strażak"],
        ["prawnik", "sędzia"],
        ["architekt", "inżynier"],
        ["malarz", "rzeźbiarz"],
        ["aktor", "reżyser"],
        ["piłkarz", "tenisista"],
        ["mechanik", "elektryk"],
        ["dentysta", "okulista"],
        ["fryzjer", "barber"],
        ["taksówkarz", "kurier"]
    ],
    "Jedzenie": [
        ["pizza", "zapiekanka"],
        ["sushi", "naleśniki"],
        ["hamburger", "hot dog"],
        ["lody", "shake"],
        ["ser", "jogurt"],
        ["chleb", "bułka"],
        ["makaron", "ryż"],
        ["zupa", "bulion"],
        ["jabłko", "gruszka"],
        ["marchewka", "burak"],
        ["schabowy", "kotlet"],
        ["pierogi", "ruskie"],
        ["kebab", "shawarma"],
        ["croissant", "pączek"],
        ["granola", "musli"]
    ],
    "Zwierzęta": [
        ["pies", "kot"],
        ["koń", "kucyk"],
        ["lew", "tygrys"],
        ["słoń", "hipopotam"],
        ["żyrafa", "zebra"],
        ["orzeł", "sokół"],
        ["niedźwiedź", "rys"],
        ["wilk", "lis"],
        ["ryba", "delfin"],
        ["żółw", "krokodyl"],
        ["pingwin", "albatros"],
        ["małpa", "orangutan"],
        ["świnka", "kangur"],
        ["kura", "kogut"],
        ["owca", "koza"]
    ],
    "Kraje i Miasta": [
        ["Polska", "Czechy"],
        ["Francja", "Włochy"],
        ["Japonia", "Chiny"],
        ["Brazylia", "Argentyna"],
        ["Islandia", "Norwegia"],
        ["Australia", "Nowa Zelandia"],
        ["Egipt", "Maroko"],
        ["Indie", "Tajlandia"],
        ["USA", "Kanada"],
        ["Hiszpania", "Portugalia"],
        ["Berlin", "Monachium"],
        ["Londyn", "Manchester"],
        ["Tokio", "Osaka"],
        ["Nowy Jork", "Los Angeles"],
        ["Kraków", "Gdańsk"]
    ],
    "Sport": [
        ["piłka nożna", "siatkówka"],
        ["tenis", "badminton"],
        ["koszykówka", "piłka ręczna"],
        ["narciarstwo", "snowboard"],
        ["pływanie", "nurkowanie"],
        ["bieganie", "maraton"],
        ["kolarstwo", "motocykl"],
        ["boks", "karate"],
        ["golf", "curling"],
        ["hokej", "curling"],
        ["żeglarstwo", "kajakarstwo"],
        ["wspinaczka", "turystyka"],
        ["joga", "pilates"],
        ["bilard", "dart"],
        ["bowling", "kręgle"]
    ],
    "Muzyka": [
        ["gitara", "ukulele"],
        ["fortepian", "keyboard"],
        ["skrzypce", "altówka"],
        ["perkusja", "bongosy"],
        ["saksofon", "trąbka"],
        ["wokal", "chór"],
        ["rock", "metal"],
        ["pop", "disco"],
        ["jazz", "blues"],
        ["hip-hop", "rap"],
        ["country", "folk"],
        ["reggae", "ska"],
        ["klasyczna", "opera"],
        ["elektroniczna", "techno"],
        ["dj", "remixer"]
    ],
    "Technologia": [
        ["komputer", "laptop"],
        ["telefon", "smartfon"],
        ["tablet", "laptop"],
        ["drukarka", "skaner"],
        ["router", "modem"],
        ["bateria", "akumulator"],
        ["ekran", "monitor"],
        ["mysz", "trackpad"],
        ["klawiatura", "controler"],
        ["sluchawki", "glosnik"],
        ["kamera", "aparat"],
        ["pendrive", "dysk"],
        ["wifi", "bluetooth"],
        ["internet", "intranet"],
        ["serwer", "chmura"]
    ],
    "Dom": [
        ["kanapa", "fotel"],
        ["łóżko", "sofa"],
        ["stół", "biurko"],
        ["krzesło", "taboret"],
        ["szafa", "komoda"],
        ["lustro", "obraz"],
        ["lampa", "żyrandol"],
        ["dywan", "chodnik"],
        ["okno", "balkon"],
        ["drzwi", "brama"],
        ["kuchnia", "lodówka"],
        ["pralka", "zmywarka"],
        ["prysznic", "wanna"],
        ["toaleta", "bidet"],
        ["balkon", "taras"]
    ],
    "Przyroda": [
        ["słońce", "księżyc"],
        ["góra", "wulkan"],
        ["rzeka", "strumień"],
        ["jezioro", "staw"],
        ["morze", "ocean"],
        ["las", "puszcza"],
        ["pustynia", "oaza"],
        ["wodospad", "fontanna"],
        ["drzewo", "krzak"],
        ["kwiat", "trawa"],
        ["śnieg", "lód"],
        ["deszcz", "mgła"],
        ["tęcza", "zorza"],
        ["gwiazda", "kometa"],
        ["chmura", "burza"]
    ],
    "Transport": [
        ["samochód", "autobus"],
        ["pociąg", "metro"],
        ["rower", "hulajnoga"],
        ["samolot", "helikopter"],
        ["statek", "prom"],
        ["tramwaj", "trolejbus"],
        ["motocykl", "skuter"],
        ["ciężarówka", "pick-up"],
        ["łódka", "kajak"],
        ["sanie", "	getline"],
        ["balon", "spadochron"],
        ["rakieta", "shuttle"],
        ["carsharing", "taxi"],
        ["e-hulajnoga", "segway"],
        ["gondola", "kolejka"]
    ]
};

function getRandomWordPair() {
    const categories = Object.keys(WORDS);
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const pairs = WORDS[randomCategory];
    const randomPair = pairs[Math.floor(Math.random() * pairs.length)];
    return {
        category: randomCategory,
        word: randomPair[0],
        impostorWord: randomPair[1]
    };
}

function getRandomWords(count) {
    const usedCategories = new Set();
    const results = [];
    
    while (results.length < count && results.length < Object.keys(WORDS).length) {
        const categories = Object.keys(WORDS).filter(c => !usedCategories.has(c));
        if (categories.length === 0) break;
        
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        usedCategories.add(randomCategory);
        
        const pairs = WORDS[randomCategory];
        const randomPair = pairs[Math.floor(Math.random() * pairs.length)];
        
        results.push({
            category: randomCategory,
            word: randomPair[0],
            impostorWord: randomPair[1]
        });
    }
    
    return results;
}
