/* 每日一人 · 问题库
 * 46 个是/否问题，分五类：时代 / 地域 / 领域 / 身份 / 生平。
 * 每个问题是一个纯谓词：ans(person) -> true/false，直接读人物属性，
 * 不查任何外部数据，保证对人物库中每个人都有确定答案。
 * 判定口径（与 PLAYBOOK「收录标准」一致）：
 *  - 国籍取"出生与文化认同的祖国"（特斯拉记塞尔维亚、爱因斯坦记德国）；
 *  - 「长期旅居国外」指约五年以上定居或改变国籍；
 *  - 「死于非命」含他杀、处决、战死、自杀与重大事故，在世者一律为否；
 *  - 「亲自统率军队作战」看史实行为，不看头衔。
 */
(function (g) {
  "use strict";

  var EN_SPEAKING = ["美国", "英国", "澳大利亚", "加拿大", "新西兰", "爱尔兰", "牙买加"];

  function aliveSpan(p, a, b) {
    // 人物在世区间 [born, died|至今] 是否与年份区间 [a,b] 相交
    var end = p.died === null ? 9999 : p.died;
    return p.born <= b && end >= a;
  }

  g.DP_QUESTIONS = [
    /* ---------- 时代（8） ---------- */
    { id: "t1", cat: "era", text: "TA 还在世吗？",
      ans: function (p) { return p.died === null; } },
    { id: "t2", cat: "era", text: "TA 出生于公元前吗？",
      ans: function (p) { return p.born < 0; } },
    { id: "t3", cat: "era", text: "TA 出生于公元 1000 年之前吗？",
      ans: function (p) { return p.born < 1000; } },
    { id: "t4", cat: "era", text: "TA 出生于 1500 年之前吗？",
      ans: function (p) { return p.born < 1500; } },
    { id: "t5", cat: "era", text: "TA 出生于 1800 年之前吗？",
      ans: function (p) { return p.born < 1800; } },
    { id: "t6", cat: "era", text: "TA 出生于 1900 年或之后吗？",
      ans: function (p) { return p.born >= 1900; } },
    { id: "t7", cat: "era", text: "TA 出生于 1950 年或之后吗？",
      ans: function (p) { return p.born >= 1950; } },
    { id: "t8", cat: "era", text: "TA 见过 21 世纪吗（2001 年时仍在世）？",
      ans: function (p) { return p.died === null || p.died >= 2001; } },

    /* ---------- 地域（9） ---------- */
    { id: "g1", cat: "geo", text: "TA 是中国人吗？",
      ans: function (p) { return p.country === "中国"; } },
    { id: "g2", cat: "geo", text: "TA 来自亚洲吗？",
      ans: function (p) { return p.region === "asia"; } },
    { id: "g3", cat: "geo", text: "TA 来自欧洲吗？",
      ans: function (p) { return p.region === "europe"; } },
    { id: "g4", cat: "geo", text: "TA 来自美洲吗？",
      ans: function (p) { return p.region === "namerica" || p.region === "samerica"; } },
    { id: "g5", cat: "geo", text: "TA 是美国人吗？",
      ans: function (p) { return p.country === "美国"; } },
    { id: "g6", cat: "geo", text: "TA 是英国人吗？",
      ans: function (p) { return p.country === "英国"; } },
    { id: "g7", cat: "geo", text: "TA 来自法国或德国吗？",
      ans: function (p) { return p.country === "法国" || p.country === "德国"; } },
    { id: "g8", cat: "geo", text: "TA 来自非洲或大洋洲吗？",
      ans: function (p) { return p.region === "africa" || p.region === "oceania"; } },
    { id: "g9", cat: "geo", text: "TA 的祖国以英语为主要语言吗？",
      ans: function (p) { return EN_SPEAKING.indexOf(p.country) >= 0; } },

    /* ---------- 领域（10） ---------- */
    { id: "f1", cat: "field", text: "TA 主要以科学成就闻名吗？",
      ans: function (p) { return p.field === "science"; } },
    { id: "f2", cat: "field", text: "TA 主要以政治、军事或社会运动闻名吗？",
      ans: function (p) { return p.field === "politics"; } },
    { id: "f3", cat: "field", text: "TA 主要以文学创作闻名吗？",
      ans: function (p) { return p.field === "literature"; } },
    { id: "f4", cat: "field", text: "TA 主要以绘画、书法、雕塑或音乐等艺术创作闻名吗？",
      ans: function (p) { return p.field === "art"; } },
    { id: "f5", cat: "field", text: "TA 主要活跃于影视、歌坛或舞台吗？",
      ans: function (p) { return p.field === "performing"; } },
    { id: "f6", cat: "field", text: "TA 是运动员吗？",
      ans: function (p) { return p.field === "sports"; } },
    { id: "f7", cat: "field", text: "TA 主要以思想、哲学或学说闻名吗？",
      ans: function (p) { return p.field === "thought"; } },
    { id: "f8", cat: "field", text: "TA 以远行、探险、航海或航天闻名吗？",
      ans: function (p) { return p.field === "exploration"; } },
    { id: "f9", cat: "field", text: "TA 与音乐密切相关吗（创作、演奏或演唱）？",
      ans: function (p) { return p.musical; } },
    { id: "f10", cat: "field", text: "TA 曾亲自统率军队作战吗？",
      ans: function (p) { return p.military; } },

    /* ---------- 身份（10） ---------- */
    { id: "i1", cat: "identity", text: "TA 是女性吗？",
      ans: function (p) { return p.gender === "f"; } },
    { id: "i2", cat: "identity", text: "TA 当过国家元首或政府首脑（帝王、总统、总理、宰相等）吗？",
      ans: function (p) { return p.head; } },
    { id: "i3", cat: "identity", text: "TA 获得过诺贝尔奖吗？",
      ans: function (p) { return p.nobel; } },
    { id: "i4", cat: "identity", text: "TA 是君主（皇帝、国王、女王、法老等）吗？",
      ans: function (p) { return p.monarch; } },
    { id: "i5", cat: "identity", text: "TA 是发明家或工程师吗？",
      ans: function (p) { return p.inventor; } },
    { id: "i6", cat: "identity", text: "TA 是画家吗？",
      ans: function (p) { return p.painter; } },
    { id: "i7", cat: "identity", text: "TA 留下过广为流传的诗作吗？",
      ans: function (p) { return p.poet; } },
    { id: "i8", cat: "identity", text: "TA 是演员吗？",
      ans: function (p) { return p.actor; } },
    { id: "i9", cat: "identity", text: "TA 是歌手吗？",
      ans: function (p) { return p.singer; } },
    { id: "i10", cat: "identity", text: "TA 是宗教人物（僧侣、神职、宗教改革者等）吗？",
      ans: function (p) { return p.religious; } },

    /* ---------- 生平（9） ---------- */
    { id: "l1", cat: "life", text: "TA 死于非命吗（被杀、处决、战死、自杀或重大事故）？",
      ans: function (p) { return p.violentDeath; } },
    { id: "l2", cat: "life", text: "TA 曾被监禁、软禁、流放或贬谪吗？",
      ans: function (p) { return p.imprisoned; } },
    { id: "l3", cat: "life", text: "TA 亲历过两次世界大战中的至少一次（战时在世）吗？",
      ans: function (p) { return aliveSpan(p, 1914, 1918) || aliveSpan(p, 1939, 1945); } },
    { id: "l4", cat: "life", text: "TA 不到 50 岁就去世了吗？",
      ans: function (p) { return p.died !== null && (p.died - p.born) < 50; } },
    { id: "l5", cat: "life", text: "TA 领导或深度参与过革命、独立或民权运动吗？",
      ans: function (p) { return p.revolutionary; } },
    { id: "l6", cat: "life", text: "TA 的头像出现在过正式流通的纸币上吗？",
      ans: function (p) { return p.banknote; } },
    { id: "l7", cat: "life", text: "TA 获得过奥运会奖牌吗？",
      ans: function (p) { return p.olympic; } },
    { id: "l8", cat: "life", text: "TA 主要是在身后才享有大名的吗？",
      ans: function (p) { return p.posthumous; } },
    { id: "l9", cat: "life", text: "TA 曾长期旅居国外（约五年以上）或改变过国籍吗？",
      ans: function (p) { return p.emigrated; } }
  ];

  g.DP_CATS = [
    { key: "era", label: "时代" },
    { key: "geo", label: "地域" },
    { key: "field", label: "领域" },
    { key: "identity", label: "身份" },
    { key: "life", label: "生平" }
  ];
})(typeof window !== "undefined" ? window : globalThis);
