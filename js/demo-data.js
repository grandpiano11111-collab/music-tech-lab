/**
 * ==========================================================================
 *  MUSIC TECH LAB - DEMO DATA (ANIME & GAME MUSIC PIANO SHOWCASE)
 * ==========================================================================
 *  最新アニソン＆ゲーム音楽のワンコーラス演奏（通常動画）とサビだけ弾いてみた（Shorts）の
 *  高品質デモデータセットです。
 */

const DEMO_DATA = {
  // ------------------------------------------------------------------------
  // 01 / MAIN COVERS (16:9 ワンコーラス メイン動画) - 18 items
  // ------------------------------------------------------------------------
  regularVideos: [
    {
      id: 'anigame_reg_01',
      youtubeId: 'M576WGiDBdQ',
      title: '【推しの子】第2期OP「ファタール」- GEMN (Piano Solo Cover / ワンコーラス)',
      description: '【推しの子】第2期オープニング主題歌「ファタール」をピアノソロで演奏しました。ダークで艶やかなストリングスとベースラインを88鍵で完全再現。',
      thumbnail: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2025-05-18T20:00:00Z',
      duration: '1:45',
      views: '420,000',
      category: 'Anime Piano'
    },
    {
      id: 'anigame_reg_02',
      youtubeId: 'fHI8X480mxo',
      title: '【原神 / Genshin Impact】フォンテーヌメインテーマ (Grand Piano Virtuoso Cover)',
      description: '『原神』フォンテーヌの壮大で優美な水上都市テーマ曲。華麗なアルペジオとワルツのリズムをピアノソロで紡ぎます。',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2025-05-02T19:30:00Z',
      duration: '2:05',
      views: '1,280,000',
      category: 'Game Music'
    },
    {
      id: 'anigame_reg_03',
      youtubeId: 's7L2PVdrb_8',
      title: '【葬送のフリーレン】OP「勇者」- YOASOBI (Piano Virtuoso Cover / ワンコーラス)',
      description: '『葬送のフリーレン』OPテーマ「勇者」のワンコーラスピアノアレンジ。旅立ちの哀愁と壮大な疾走感をピアノのダイナミクスで描きます。',
      thumbnail: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2025-04-20T21:00:00Z',
      duration: '1:52',
      views: '890,000',
      category: 'Anime Piano'
    },
    {
      id: 'anigame_reg_04',
      youtubeId: 'W3q8Od5qJio',
      title: '【ゼルダの伝説 ティアキン】メインテーマ (Epic Piano Solo Cover)',
      description: '『ゼルダの伝説 ティアーズ オブ ザ キングダム』メインテーマ。天空と地底を翔ける勇壮な冒険譚を88鍵で熱演。',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2025-04-05T18:00:00Z',
      duration: '2:15',
      views: '1,950,000',
      category: 'Game Music'
    },
    {
      id: 'anigame_reg_05',
      youtubeId: '4Tr0otuiQuU',
      title: '【呪術廻戦 懐玉・玉折】OP「青のすみか」- キタニタツヤ (Emotional Piano / ワンコーラス)',
      description: '『呪術廻戦 懐玉・玉折』OPテーマ「青のすみか」を情感豊かにアレンジ。爽快感と戻らない青春の切なさを込めて演奏しました。',
      thumbnail: 'https://images.unsplash.com/photo-1520523839898-507125cd53c1?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2025-03-22T20:15:00Z',
      duration: '1:38',
      views: '1,150,000',
      category: 'Anime Piano'
    },
    {
      id: 'anigame_reg_06',
      youtubeId: 'wygy721nzRc',
      title: '【NieR:Automata】「Weight of the World」- 壊レタ世界ノ歌 (Piano Noir Cover)',
      description: '『ニーア オートマタ』不朽の名曲。絶望と祈りが交錯するメロディを、繊細なピアニッシモから激情のクライマックスまで演奏。',
      thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2025-03-10T19:00:00Z',
      duration: '2:20',
      views: '2,450,000',
      category: 'Game Music'
    },
    {
      id: 'anigame_reg_07',
      youtubeId: 'dQw4w9WgXcQ',
      title: '【ダンダダン】OP「オトノケ」- Creepy Nuts (Piano Solo Fast Beats / ワンコーラス)',
      description: 'アニメ『ダンダダン』OP「オトノケ」の怪異的で高速なジャージークラブビートをピアノの打鍵テクニックで再構築。',
      thumbnail: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2025-02-28T18:30:00Z',
      duration: '1:30',
      views: '730,000',
      category: 'Anime Piano'
    },
    {
      id: 'anigame_reg_08',
      youtubeId: 'kJQP7kiw5Fk',
      title: '【ペルソナ5 / P5R】「Life Will Change」- (Stylish Jazz Piano Solo)',
      description: '『ペルソナ5』予告状テーマ曲。スリリングなウォーキングベースとファンキーなコードワークが炸裂するジャズピアノアレンジ。',
      thumbnail: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2025-02-14T20:00:00Z',
      duration: '1:50',
      views: '1,620,000',
      category: 'Game Music'
    },
    {
      id: 'anigame_reg_09',
      youtubeId: '9bZkp7q19f0',
      title: '【チェンソーマン】OP「KICK BACK」- 米津玄師 (Extreme Piano Solo / ワンコーラス)',
      description: '狂乱のベースリフと変拍子をピアノ一台で爆発させたワンコーラスアレンジ。限界ギリギリのテンポでお届けします。',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2025-01-30T19:45:00Z',
      duration: '1:42',
      views: '1,520,000',
      category: 'Anime Piano'
    },
    {
      id: 'anigame_reg_10',
      youtubeId: 'L_LUpnjgPso',
      title: '【FF7 リバース】「エアリスのテーマ」- (Acoustic Piano Masterpiece)',
      description: '『FINAL FANTASY VII REBIRTH』より。世界中を涙させた永遠の旋律を、空間オーディオで録音したピアノソロ。',
      thumbnail: 'https://images.unsplash.com/photo-1542120526-89a7039730ab?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2025-01-15T21:30:00Z',
      duration: '2:30',
      views: '3,100,000',
      category: 'Game Music'
    },
    {
      id: 'anigame_reg_11',
      youtubeId: 'kxyTejFqY6o',
      title: '【推しの子】第1期OP「アイドル」- YOASOBI (Virtuoso Concert Piano / ワンコーラス)',
      description: '世界的大ヒット「アイドル」をコンサートピアノ風の超絶技巧アレンジで演奏。華やかさと狂気のコントラストをお楽しみください。',
      thumbnail: 'https://images.unsplash.com/photo-1513829596324-4bb2800c5efb?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2024-12-25T18:00:00Z',
      duration: '1:58',
      views: '2,820,000',
      category: 'Anime Piano'
    },
    {
      id: 'anigame_reg_12',
      youtubeId: 'CevxZvSJLk8',
      title: '【Undertale】「MEGALOVANIA」- サンズ戦BGM (Insane Speed Piano Solo)',
      description: '『UNDERTALE』より。容赦ない高速オクターブ連打とヘヴィなジャズロックビートを完全再現した熱狂の演奏。',
      thumbnail: 'https://images.unsplash.com/photo-1518972559570-7cc1309f3229?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2024-12-10T20:00:00Z',
      duration: '1:55',
      views: '3,850,000',
      category: 'Game Music'
    },
    {
      id: 'anigame_reg_13',
      youtubeId: 'M576WGiDBdQ',
      title: '【鬼滅の刃 刀鍛冶の里編】OP「絆ノ奇跡」- MAN WITH A MISSION × milet (Piano Cover)',
      description: '和の情緒とロックの力強さが交錯する刀鍛冶の里編主題歌。三味線フレーズと壮大なコーラスをピアノで再現。',
      thumbnail: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2024-11-28T19:00:00Z',
      duration: '1:40',
      views: '940,000',
      category: 'Anime Piano'
    },
    {
      id: 'anigame_reg_14',
      youtubeId: 'fHI8X480mxo',
      title: '【ポケットモンスター S・V】「エリアゼロ / ゼロの秘宝」BGM (Glitch Spatial Piano)',
      description: '『ポケモン スカーレット・バイオレット』エリアゼロの神秘的でエレクトロニックな世界観をアコースティックピアノで昇華。',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2024-11-14T20:30:00Z',
      duration: '1:48',
      views: '880,000',
      category: 'Game Music'
    },
    {
      id: 'anigame_reg_15',
      youtubeId: 's7L2PVdrb_8',
      title: '【東方Project】「Bad Apple!! feat. nomico」- (Virtuoso Concert Jazz Piano)',
      description: '東方不朽の神曲。洗練されたモダンジャズボイシングと超速ソロを詰め込んだハイエンドアレンジ。',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2024-10-30T18:15:00Z',
      duration: '2:10',
      views: '2,900,000',
      category: 'Game Music'
    },
    {
      id: 'anigame_reg_16',
      youtubeId: 'W3q8Od5qJio',
      title: '【薬屋のひとりごと】OP「花になって」- 緑黄色社会 (Intense Piano / ワンコーラス)',
      description: '怪しくも華麗な毒気を帯びたメロディ。スリリングなコード展開をピアノソロで鮮烈に描きます。',
      thumbnail: 'https://images.unsplash.com/photo-1520523839898-507125cd53c1?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2024-10-15T19:00:00Z',
      duration: '1:44',
      views: '950,000',
      category: 'Anime Piano'
    },
    {
      id: 'anigame_reg_17',
      youtubeId: '4Tr0otuiQuU',
      title: '【ELDEN RING】メインテーマ「The Final Battle」- (Heavy Epic Piano Solo)',
      description: '『エルデンリング』ラダゴン戦BGM。重厚な打鍵と地を揺るがす低音オクターブで黄金樹の戦いを描く。',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2024-09-28T21:00:00Z',
      duration: '2:00',
      views: '1,450,000',
      category: 'Game Music'
    },
    {
      id: 'anigame_reg_18',
      youtubeId: 'wygy721nzRc',
      title: '【SPY×FAMILY】OP「ミックスナッツ」- Official髭男dism (Virtuoso Jazz Piano)',
      description: '高速ウォーキングベースとスウィングするジャズボイシング。弾いていて最も楽しい難関アニソンワンコーラス。',
      thumbnail: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=1200&auto=format&fit=crop',
      publishedAt: '2024-09-10T19:30:00Z',
      duration: '1:48',
      views: '1,300,000',
      category: 'Anime Piano'
    }
  ],

  // ------------------------------------------------------------------------
  // 02 / SHORTS (9:16 サビだけ弾いてみた) - 24 items
  // ------------------------------------------------------------------------
  shortsVideos: [
    {
      id: 'anigame_sht_01',
      youtubeId: 'fHI8X480mxo',
      title: '【サビだけ】ファタール / GEMN（推しの子2期OP）弾いてみた⚡ #shorts #推しの子 #piano',
      description: 'アクアとルビーの覚悟。サビの疾走感を1分で！',
      thumbnail: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-05-20T12:00:00Z',
      views: '840K',
      likes: '45K'
    },
    {
      id: 'anigame_sht_02',
      youtubeId: 'M576WGiDBdQ',
      title: '【サビだけ】原神 フォンテーヌ 水中テーマ サビ弾き🌊 #shorts #原神 #GenshinImpact',
      description: '美しすぎる水の旋律をピアノで！',
      thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-05-15T15:30:00Z',
      views: '1.5M',
      likes: '120K'
    },
    {
      id: 'anigame_sht_03',
      youtubeId: 's7L2PVdrb_8',
      title: '【サビだけ】勇者 / YOASOBI（葬送のフリーレンOP）超絶サビ弾き🧝‍♀️ #shorts #YOASOBI',
      description: '右手オクターブ連打の限界に挑戦。',
      thumbnail: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-05-10T18:00:00Z',
      views: '950K',
      likes: '68K'
    },
    {
      id: 'anigame_sht_04',
      youtubeId: 'W3q8Od5qJio',
      title: '【サビだけ】ゼルダの伝説 ティアキン メインテーマ サビ激奏🗡️ #shorts #ゼルダの伝説',
      description: '鳥肌が止まらない神サビ！',
      thumbnail: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-05-05T11:45:00Z',
      views: '2.4M',
      likes: '180K'
    },
    {
      id: 'anigame_sht_05',
      youtubeId: '4Tr0otuiQuU',
      title: '【サビだけ】青のすみか / キタニタツヤ（呪術廻戦）エモすぎるサビ🤞 #shorts #呪術廻戦',
      description: 'このコード進行が刺さる人は高評価！',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-04-28T20:00:00Z',
      views: '1.4M',
      likes: '110K'
    },
    {
      id: 'anigame_sht_06',
      youtubeId: 'wygy721nzRc',
      title: '【サビだけ】NieR Weight of the World 涙腺崩壊サビ🤖 #shorts #NieRAutomata',
      description: '2Bと9Sの祈り。',
      thumbnail: 'https://images.unsplash.com/photo-1542120526-89a7039730ab?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-04-22T17:30:00Z',
      views: '1.9M',
      likes: '145K'
    },
    {
      id: 'anigame_sht_07',
      youtubeId: 'dQw4w9WgXcQ',
      title: '【サビだけ】オトノケ / Creepy Nuts（ダンダダンOP）最速サビ👻 #shorts #ダンダダン',
      description: '指が追いつかない爆速アニソンピアノ。',
      thumbnail: 'https://images.unsplash.com/photo-1513829596324-4bb2800c5efb?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-04-16T14:15:00Z',
      views: '1.8M',
      likes: '110K'
    },
    {
      id: 'anigame_sht_08',
      youtubeId: 'kJQP7kiw5Fk',
      title: '【サビだけ】ペルソナ5 Life Will Change カッコよすぎるサビ🎩 #shorts #P5R',
      description: 'オタカラをいただきに参上！',
      thumbnail: 'https://images.unsplash.com/photo-1518972559570-7cc1309f3229?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-04-10T22:00:00Z',
      views: '2.1M',
      likes: '160K'
    },
    {
      id: 'anigame_sht_09',
      youtubeId: '9bZkp7q19f0',
      title: '【サビだけ】KICK BACK / 米津玄師（チェンソーマン）暴走サビ🪚 #shorts #チェンソーマン',
      description: '努力 未来 A BEAUTIFUL STAR!',
      thumbnail: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-04-03T19:00:00Z',
      views: '1.7M',
      likes: '130K'
    },
    {
      id: 'anigame_sht_10',
      youtubeId: 'L_LUpnjgPso',
      title: '【サビだけ】FF7 エアリスのテーマ 最も美しいサビ🌸 #shorts #FF7R',
      description: 'いつ聴いても泣ける神メロディ。',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-03-27T16:45:00Z',
      views: '2.8M',
      likes: '210K'
    },
    {
      id: 'anigame_sht_11',
      youtubeId: 'kxyTejFqY6o',
      title: '【サビだけ】アイドル / YOASOBI 狂気と究極のサビ🌟 #shorts #推しの子 #piano',
      description: '完璧で究極のアイドルをピアノで！',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-03-20T21:10:00Z',
      views: '3.1M',
      likes: '240K'
    },
    {
      id: 'anigame_sht_12',
      youtubeId: 'CevxZvSJLk8',
      title: '【サビだけ】Undertale MEGALOVANIA サンズ戦サビ激突💀 #shorts #undertale',
      description: '最悪の時間を過ごしたいかい？',
      thumbnail: 'https://images.unsplash.com/photo-1520523839898-507125cd53c1?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-03-14T13:20:00Z',
      views: '3.6M',
      likes: '310K'
    },
    {
      id: 'anigame_sht_13',
      youtubeId: 'M576WGiDBdQ',
      title: '【サビだけ】Bling-Bang-Bang-Born / Creepy Nuts ピアノでBBBBダンス🪄 #shorts',
      description: 'ノリノリで弾いてみた！',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-03-08T18:00:00Z',
      views: '2.9M',
      likes: '220K'
    },
    {
      id: 'anigame_sht_14',
      youtubeId: 'fHI8X480mxo',
      title: '【サビだけ】東方 Bad Apple!! 超絶ジャズサビ弾き🍎 #shorts #東方Project',
      description: '右手の指が爆発するアレンジ！',
      thumbnail: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-03-01T15:00:00Z',
      views: '1.6M',
      likes: '125K'
    },
    {
      id: 'anigame_sht_15',
      youtubeId: 's7L2PVdrb_8',
      title: '【サビだけ】ポケモンSV エリアゼロ サビの浮遊感🌌 #shorts #ポケモンSV',
      description: 'パラドックス空間の響き。',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-02-23T20:45:00Z',
      views: '890K',
      likes: '62K'
    },
    {
      id: 'anigame_sht_16',
      youtubeId: 'W3q8Od5qJio',
      title: '【サビだけ】あのバンド / 結束バンド ギターソロピアノ再現🎸 #shorts #ぼざろ',
      description: 'ぼっちちゃんのソロを88鍵で！',
      thumbnail: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-02-16T23:30:00Z',
      views: '1.5M',
      likes: '120K'
    },
    {
      id: 'anigame_sht_17',
      youtubeId: '4Tr0otuiQuU',
      title: '【サビだけ】花になって / 緑黄色社会 サビ連打弾き🌸 #shorts #薬屋のひとりごと',
      description: '毒々しく美しいサビの爆発力。',
      thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-02-10T17:15:00Z',
      views: '880K',
      likes: '65K'
    },
    {
      id: 'anigame_sht_18',
      youtubeId: 'wygy721nzRc',
      title: '【サビだけ】ELDEN RING ラダゴン戦BGM 重低音サビ🔥 #shorts #ELDENRING',
      description: 'エルデの王を目指して。',
      thumbnail: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-02-02T12:00:00Z',
      views: '1.1M',
      likes: '85K'
    },
    {
      id: 'anigame_sht_19',
      youtubeId: 'dQw4w9WgXcQ',
      title: '【サビだけ】ミックスナッツ / Official髭男dism 超速サビ🥜 #shorts #SPY_FAMILY',
      description: '左手のジャズベースが止まらない。',
      thumbnail: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-01-25T19:20:00Z',
      views: '1.8M',
      likes: '110K'
    },
    {
      id: 'anigame_sht_20',
      youtubeId: 'kJQP7kiw5Fk',
      title: '【サビだけ】すずめ / RADWIMPS 涙腺崩壊サビ🗝️ #shorts #すずめの戸締まり',
      description: '映画館の感動をサビだけで。',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-01-18T16:00:00Z',
      views: '730K',
      likes: '51K'
    },
    {
      id: 'anigame_sht_21',
      youtubeId: '9bZkp7q19f0',
      title: '【サビだけ】SPECIALZ / King Gnu（呪術廻戦 渋谷事変OP）🕶️ #shorts #呪術廻戦',
      description: 'U R MY SPECIAL サビ弾き！',
      thumbnail: 'https://images.unsplash.com/photo-1542120526-89a7039730ab?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-01-10T21:00:00Z',
      views: '2.1M',
      likes: '160K'
    },
    {
      id: 'anigame_sht_22',
      youtubeId: 'L_LUpnjgPso',
      title: '【サビだけ】残響散歌 / Aimer（鬼滅の刃 遊郭編OP）サビド派手弾き🎆 #shorts #鬼滅の刃',
      description: '宇髄天元のド派手なサビを再現！',
      thumbnail: 'https://images.unsplash.com/photo-1513829596324-4bb2800c5efb?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2025-01-03T22:30:00Z',
      views: '2.6M',
      likes: '190K'
    },
    {
      id: 'anigame_sht_23',
      youtubeId: 'kxyTejFqY6o',
      title: '【サビだけ】絆ノ奇跡 / MWAM×milet 刀鍛冶の里編サビ⚔️ #shorts #鬼滅の刃',
      description: '熱い魂がぶつかり合うサビ展開。',
      thumbnail: 'https://images.unsplash.com/photo-1518972559570-7cc1309f3229?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2024-12-24T18:00:00Z',
      views: '880K',
      likes: '66K'
    },
    {
      id: 'anigame_sht_24',
      youtubeId: 'CevxZvSJLk8',
      title: '【サビだけ】紅蓮華 / LiSA（鬼滅の刃）伝説のサビ弾き🔥 #shorts #鬼滅の刃',
      description: '何度弾いても熱くなる不朽の名サビ。',
      thumbnail: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=600&auto=format&fit=crop',
      publishedAt: '2024-12-15T21:45:00Z',
      views: '3.5M',
      likes: '290K'
    }
  ],

  // ------------------------------------------------------------------------
  // Piascore 楽譜データ（将来のPiascore API同期用フォーマット / 仮データ3件）
  // ------------------------------------------------------------------------
  sheets: [
    {
      id: 'sheet_01',
      title: 'ファタール / GEMN',
      titleColor: '#ffffff',
      workTitle: '【推しの子】第2期 OP',
      description: 'ダークで艶やかな旋律を完全再現。右手メロディ五線譜・ドレミ音階・CDEコード付きワンコーラス楽譜。',
      thumbnail: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=800&auto=format&fit=crop',
      price: '440',
      currency: '¥',
      taxIncluded: true,
      tag: 'HOT',
      tagType: 'hot',
      specs: ['右手五線譜', 'ドレミ付き', 'CDE表記', 'PDF即時DL'],
      storeUrl: 'https://piascore.com'
    },
    {
      id: 'sheet_02',
      title: '勇者 / YOASOBI',
      titleColor: '#ffffff',
      workTitle: '【葬送のフリーレン】OP',
      description: '壮大で疾走感あふれるアレンジ。初心者も弾きやすいドレミ案内付きワンコーラスピアノ楽譜。',
      thumbnail: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=800&auto=format&fit=crop',
      price: '440',
      currency: '¥',
      taxIncluded: true,
      tag: 'POPULAR',
      tagType: 'popular',
      specs: ['右手五線譜', 'ドレミ付き', 'CDE表記', 'PDF即時DL'],
      storeUrl: 'https://piascore.com'
    },
    {
      id: 'sheet_03',
      title: 'フォンテーヌ メインテーマ',
      titleColor: '#ffffff',
      workTitle: '【原神 / Genshin Impact】',
      description: '美しく優美な水上都市のワルツ。華麗なアルペジオとメロディを両立したソロピアノ楽譜。',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
      price: '440',
      currency: '¥',
      taxIncluded: true,
      tag: 'GAME MUSIC',
      tagType: 'game',
      specs: ['右手五線譜', 'ドレミ付き', 'CDE表記', 'PDF即時DL'],
      storeUrl: 'https://piascore.com'
    }
  ]
};

// グローバルスコープに公開
window.DEMO_DATA = DEMO_DATA;
