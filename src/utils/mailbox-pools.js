/**
 * Human-like mailbox word pools.
 *
 * Sources used during curation:
 * - SSA top names page (2025 snapshot): https://www.ssa.gov/oact/babynames/decades/century.html
 * - dominictarr/random-name datasets:
 *   - https://raw.githubusercontent.com/dominictarr/random-name/master/first-names.json
 *   - https://raw.githubusercontent.com/dominictarr/random-name/master/names.json
 *
 * Pools are normalized to lowercase ASCII and filtered for mailbox safety.
 */

export const FIRST_NAME_POOL = [
  'aaren', 'adah', 'adelice', 'adrea', 'agata', 'aidan', 'aimil', 'albertine', 'alexi', 'alida', 'alla', 'allyce',
  'alvera', 'amabelle', 'amber', 'ammamaria', 'anatola', 'anestassia', 'angelita', 'annadiana', 'anneliese', 'anthe', 'ara', 'ardenia',
  'ariella', 'arline', 'ashley', 'aubree', 'auguste', 'aurora', 'ayn', 'barbe', 'beatrice', 'belia', 'benetta', 'bernardine',
  'berte', 'bethany', 'bev', 'bidget', 'blaire', 'blondelle', 'bonita', 'breanne', 'bridget', 'brit', 'brook', 'cacilia',
  'camala', 'candida', 'cari', 'carlen', 'carma', 'carol', 'carri', 'cassandry', 'catherin', 'catlaina', 'ceil', 'celinka',
  'charissa', 'charmane', 'cheri', 'cherye', 'christa', 'christine', 'cindelyn', 'clareta', 'claudelle', 'cleo', 'coletta', 'conny',
  'coralie', 'corette', 'cornelle', 'cosette', 'cristin', 'cyndia', 'dagmar', 'damita', 'danit', 'darbie', 'darleen', 'dasya',
  'deane', 'dedie', 'delcina', 'demeter', 'deonne', 'devora', 'dinah', 'doe', 'donella', 'doralynn', 'dorice', 'dorree',
  'dreddy', 'dulcia', 'dynah', 'eddy', 'edy', 'elbertina', 'elfrida', 'elissa', 'ellissa', 'elset', 'elysha', 'emilia',
  'emmi', 'eran', 'erminia', 'esta', 'ethelyn', 'eva', 'evita', 'fancie', 'faun', 'federica', 'ferdinande', 'filide',
  'florence', 'flory', 'franky', 'fredia', 'gabriell', 'gavra', 'genevra', 'georgette', 'gerladina', 'gertrudis', 'gilli', 'gipsy',
  'glen', 'glynnis', 'gratiana', 'grissel', 'gusta', 'gwenore', 'halli', 'harmonia', 'hazel', 'heidie', 'henrie', 'hestia',
  'holli', 'hyacinthia', 'ilene', 'ines', 'iolanthe', 'isadora', 'izabel', 'jacquelin', 'jamie', 'janelle', 'janine', 'jasmina',
  'jeanne', 'jeni', 'jennilee', 'jessalin', 'jillana', 'joanie', 'jodi', 'johanna', 'joly', 'jorry', 'joya', 'juieta',
  'julina', 'kacy', 'kalie', 'kara', 'karine', 'karmen', 'karyn', 'katey', 'kathryn', 'kattie', 'keelia', 'kellyann',
  'kerstin', 'kiley', 'kippy', 'kitti', 'kore', 'kriste', 'kyla', 'laetitia', 'laraine', 'laural', 'laurie', 'leanor',
  'leigha', 'leodora', 'lesley', 'lexi', 'libbi', 'lilith', 'lindsey', 'lisabeth', 'livia', 'lola', 'loralyn', 'lorie',
  'lotta', 'lucie', 'luisa', 'lyn', 'lynne', 'madalyn', 'madelon', 'maggee', 'mala', 'malvina', 'marcelle', 'margalit',
  'margette', 'marianna', 'marigold', 'marissa', 'marleah', 'marnie', 'martina', 'marylee', 'mattie', 'mavra', 'meg', 'melantha',
  'melisse', 'melony', 'merissa', 'merrill', 'michelina', 'mildrid', 'mindy', 'mirabelle', 'mitzi', 'monica', 'moyna', 'myrilla',
  'nady', 'nanice', 'natalee', 'nedi', 'nert', 'netty', 'nicolina', 'ninon', 'noemi', 'noreen', 'odella', 'olive',
  'oona', 'orelie', 'paige', 'pat', 'paulie', 'peggy', 'perrine', 'phedra', 'phyllida', 'poppy', 'quinn', 'rafaelita',
  'randy', 'raye', 'reeba', 'renata', 'rheta', 'ricca', 'roana', 'robinetta', 'romola', 'rori', 'rosalyn', 'roselle',
  'row', 'rozanna', 'ruthann', 'sadella', 'sam', 'sarah', 'savina', 'seline', 'shandee', 'shara', 'shauna', 'sheelah',
  'shellie', 'shina', 'sibeal', 'silva', 'sissy', 'sophronia', 'starr', 'stephie', 'sunny', 'suzanne', 'tabbatha', 'talyah',
  'tana', 'tasha', 'teena', 'terry', 'theo', 'tierney', 'tim', 'tobi', 'tonya', 'trenna', 'trudey', 'ulrike',
  'valencia', 'vally', 'venita', 'veronika', 'vina', 'vita', 'vivienne', 'wandis'
];

export const LAST_NAME_POOL = [
  'aaberg', 'abrahan', 'adali', 'adelric', 'africah', 'ailbert', 'alasdair', 'alcinia', 'alenson', 'alford', 'allerus', 'alpers',
  'alvin', 'amatruda', 'amling', 'anastos', 'andreas', 'anjali', 'antoinetta', 'apthorp', 'ardolino', 'arman', 'arnoldo', 'arundel',
  'asquith', 'athelstan', 'auberbach', 'aurelio', 'azarcon', 'baillie', 'balling', 'bannerman', 'barboza', 'barnebas', 'bartholomew', 'bashemeth',
  'batista', 'bearnard', 'beckman', 'belayneh', 'benedetto', 'benkley', 'bergeron', 'berkshire', 'bertelli', 'bethesda', 'biamonte', 'binetta',
  'blackman', 'blatman', 'bodrogi', 'bolton', 'bores', 'bottali', 'bowles', 'bradman', 'brandtr', 'brecher', 'bricker', 'brittnee',
  'bronder', 'browning', 'buchalter', 'bueschel', 'burford', 'burnham', 'buskirk', 'cadman', 'caldeira', 'calvert', 'caneghem', 'carberry',
  'carlisle', 'carrelli', 'cassady', 'caton', 'cedell', 'chaddie', 'champaigne', 'chappell', 'chassin', 'chelton', 'cheyney', 'chlores',
  'christis', 'cichocki', 'clarisa', 'clayson', 'cleodel', 'cloutman', 'cohleen', 'collins', 'combes', 'connors', 'cooperstein', 'corley',
  'corvese', 'countess', 'cranford', 'cressida', 'crofoot', 'culhert', 'cutcliffe', 'daffodil', 'damalus', 'dannica', 'darton', 'dearborn',
  'delanie', 'demakis', 'dennett', 'descombes', 'dewhirst', 'dickinson', 'dinerman', 'dobson', 'domenech', 'donaugh', 'dorison', 'douville',
  'dressel', 'dunaville', 'durrace', 'dyson', 'ebberta', 'edgard', 'edwards', 'eisen', 'eldrida', 'ellingston', 'elwaine', 'encratis',
  'ephraim', 'erickson', 'esbensen', 'etienne', 'euphemie', 'evelinn', 'ezekiel', 'fachini', 'falzetta', 'farrica', 'favianus', 'feldstein',
  'ferdinana', 'ferriter', 'filberto', 'fineman', 'fitzgerald', 'fleming', 'follansbee', 'forrest', 'fougere', 'frankel', 'fredenburg', 'freemon',
  'friedman', 'fronnia', 'gabbert', 'galitea', 'ganley', 'garibull', 'garrison', 'gathers', 'gayelord', 'geithner', 'gentes', 'gerhard',
  'gerstner', 'gian', 'gilbert', 'gilletta', 'giorgio', 'gladdie', 'glovsky', 'goines', 'goldwin', 'goodhen', 'gorski', 'goulette',
  'granthem', 'greenfield', 'gregorius', 'griffith', 'grishilde', 'grubman', 'guillemette', 'gustavus', 'hagerman', 'halland', 'hamburger', 'hanforrd',
  'harberd', 'harilda', 'harshman', 'hasen', 'hausner', 'haywood', 'hegarty', 'helbonna', 'henderson', 'henning', 'hercules', 'herrington',
  'hessney', 'hightower', 'hillell', 'hirasuna', 'hoffert', 'holleran', 'honebein', 'hortensa', 'howard', 'huckaby', 'hultgren', 'huntley',
  'huxham', 'ignacio', 'inerney', 'iolenta', 'isbella', 'jacinto', 'jahdiel', 'jansen', 'jasen', 'jeffers', 'jepson', 'jessen',
  'johan', 'jolenta', 'joses', 'justicz', 'kallman', 'karolyn', 'kaufman', 'keligot', 'kennedy', 'kerman', 'kieffer', 'kinelski',
  'kirkpatrick', 'klemens', 'knighton', 'koerlin', 'koralie', 'krasner', 'krishna', 'krueger', 'kutchins', 'lachish', 'lambart', 'lancaster',
  'langham', 'larentia', 'lasley', 'latrell', 'laurens', 'layton', 'lecia', 'leighton', 'lennard', 'leschen', 'levinson', 'lichtenfeld',
  'lili', 'lindell', 'linson', 'littell', 'lodovico', 'longerich', 'loring', 'lovell', 'lucilla', 'lundeen', 'lyckman', 'macegan',
  'macnamara', 'maddocks', 'magocsi', 'malamud', 'maltzman', 'manlove', 'marabelle', 'marelya', 'marijane', 'marolda', 'martell', 'marucci',
  'materse', 'matthew', 'mauretta', 'maxwell', 'mccafferty', 'mcclure', 'mcdermott', 'mcintosh', 'mcnalley', 'meagher', 'melamed', 'melton',
  'menell', 'merkley', 'meunier', 'mickelson', 'miles', 'milton', 'mitman', 'moises', 'montana', 'moretta', 'morton', 'moureaux',
  'mumford', 'musette', 'nahshun', 'nashoma', 'nazario', 'neslund', 'newfeld', 'nickles', 'nierman', 'nobell', 'norman', 'novello',
  'oakley', 'octavla', 'olivero', 'oman', 'oribelle', 'oruntha', 'oulman', 'orourke', 'padriac', 'panayiotis', 'parette', 'partridge',
  'patrick', 'pawsner', 'peddada', 'pellikka', 'pentheam', 'perpetua', 'peterus', 'pfister', 'philender', 'phionna', 'pietrek', 'pirozzo',
  'platon', 'pomcroy', 'portwine', 'prentice', 'primaveras', 'prospero', 'pulchi', 'quennie', 'quiteri', 'radloff', 'raimund', 'ramburt',
  'raphael', 'rayford', 'redmond', 'reiners', 'renard', 'rexferd', 'ricardama', 'richman', 'riesman', 'risley', 'robinson', 'rodgers',
  'rolando', 'ronnholm', 'rosenblast', 'rossing', 'rovelli', 'rudyard', 'russon', 'sachiko', 'sailesh', 'salomon', 'sampson', 'sandler',
  'sapienza', 'satterlee', 'sayers', 'schaffel', 'schenck', 'schluter', 'scholem', 'schroer', 'schweitzer', 'scribner', 'season', 'seftton',
  'sell', 'seraphim', 'seton', 'shakespeare', 'sheeran', 'sherard', 'sherris', 'shing', 'shorter', 'shurwood', 'siegler', 'sillsby',
  'simpkins', 'siward', 'skutchan', 'snashall', 'somerset', 'southard', 'spenser', 'spring', 'standice', 'stanton', 'stearne', 'stempien',
  'stevens', 'stirling', 'storfer', 'strepphon', 'studley', 'sullivan', 'svensen', 'swinton', 'taddeusz', 'tamanaha', 'tarton', 'tellford',
  'terbecki', 'tertius', 'thanasi', 'thibaud', 'thorfinn', 'thorwald', 'tichonn', 'tillinger', 'tipton', 'tolmann', 'tormoria', 'trahurn',
  'tremann', 'trimble', 'troxell', 'tullius', 'ulberto', 'urbannal', 'vaenfila', 'valleau', 'vashtee', 'vedetta', 'verneuil', 'viguerie',
  'virendra', 'vogeley', 'waddington', 'walburga'
];

export const NEUTRAL_MAILBOX_WORDS = [
  'inbox', 'mailbox', 'mail', 'post', 'letter', 'notes', 'hello', 'contact', 'social', 'updates', 'alerts', 'digest',
  'family', 'friends', 'work', 'office', 'home', 'travel', 'studio', 'journal', 'daily', 'weekly', 'city', 'coast',
  'valley', 'north', 'south', 'east', 'west', 'sunny', 'lucky', 'happy', 'silver', 'golden', 'violet', 'maple',
  'river', 'forest', 'meadow', 'cloud', 'star', 'nova', 'pixel', 'byte', 'alpha', 'beta', 'gamma', 'echo',
  'orbit', 'zen', 'neo', 'atlas', 'lotus', 'olive', 'amber', 'coral', 'iris', 'pearl', 'dawn', 'dusk',
  'breeze', 'harbor', 'summit', 'sprout', 'mint', 'peach', 'plum', 'berry', 'citrus', 'cocoa', 'mocha', 'saffron',
  'teal', 'indigo', 'marin', 'garden', 'courier', 'sender', 'reader', 'thread', 'memo', 'signal'
];

export const SOFT_YEAR_SUFFIXES = [
  '1972', '1973', '1974', '1975', '1976', '1977', '1978', '1979', '1980', '1981', '1982', '1983',
  '1984', '1985', '1986', '1987', '1988', '1989', '1990', '1991', '1992', '1993', '1994', '1995',
  '1996', '1997', '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007',
  '2008', '2009', '2010'
];

export const SOFT_MISC_SUFFIXES = [
  '01', '02', '03', '07', '08', '09', '10', '11', '12', '13', '17', '21',
  '22', '23', '24', '88', '99', 'x', 'mail', 'box', 'home', 'work', 'pro'
];
