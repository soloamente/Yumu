# NihongoHub Discord Bot

Un bot Discord completo per una community di apprendimento del giapponese, con giochi educativi, sistema di livelli, giveaway, eventi e molto altro!

## Funzionalità

### 🎮 Giochi Educativi
- **Shiritori** - Il classico gioco della catena di parole giapponesi
- **Kanji Quiz** - Quiz per imparare i kanji
- **Vocab Quiz** - Quiz sul vocabolario con traduzioni
- **Number Game** - Pratica i numeri giapponesi
- **Word Bomb** - Trova parole che contengono caratteri specifici
- **Typing Game** - Pratica la scrittura in giapponese
- **Story Game** - Completa le frasi con la parola corretta

### 📚 Studio
- **Jisho Integration** - Ricerca parole nel dizionario Jisho.org
- **Parola del Giorno** - Post automatico giornaliero con nuove parole
- **Study Tracker** - Tieni traccia delle tue sessioni di studio

### 🏆 Sistema Livelli
- Guadagna XP partecipando e giocando
- Livelli con ruoli automatici
- Leaderboard e statistiche personali

### 🎉 Community
- **Giveaway** - Sistema completo per giveaway
- **Eventi** - Crea e gestisci eventi con reminder automatici
- **Messaggi di Benvenuto** - Personalizzabili per nuovi membri

## Installazione

### Requisiti
- Node.js 18+ 
- Un bot Discord (crea su [Discord Developer Portal](https://discord.com/developers/applications))

### Setup

1. **Clona il repository e installa le dipendenze:**
```bash
cd nihongo-bot
npm install
```

2. **Configura le variabili d'ambiente:**

Copia `env.example` in `.env` e modifica i valori:
```bash
cp env.example .env
```

Modifica `.env`:
```env
# Obbligatorio
DISCORD_TOKEN=il_tuo_token_bot
CLIENT_ID=il_tuo_client_id
GUILD_ID=il_tuo_server_id  # Per test locale

# Opzionale
DATABASE_PATH=./data/nihongo.db
DAILY_WORD_HOUR=9
DAILY_WORD_MINUTE=0
```

3. **Deploy dei comandi slash:**
```bash
npm run deploy
```

4. **Avvia il bot:**
```bash
# Sviluppo (con hot reload)
npm run dev

# Produzione
npm run build
npm start
```

## Comandi Disponibili

### Giochi
| Comando | Descrizione |
|---------|-------------|
| `/shiritori start` | Inizia una partita di Shiritori |
| `/kanji quiz` | Quiz sui kanji |
| `/vocab quiz` | Quiz sul vocabolario |
| `/numbers quiz` | Quiz sui numeri giapponesi |
| `/wordbomb start` | Inizia Word Bomb |
| `/typing start` | Pratica di battitura |
| `/story play` | Completa le frasi |

### Studio
| Comando | Descrizione |
|---------|-------------|
| `/jisho [parola]` | Cerca nel dizionario |
| `/dailyword now` | Invia la parola del giorno |
| `/study log [minuti]` | Registra sessione di studio |
| `/study stats` | Statistiche di studio |
| `/study streak` | Mostra lo streak |

### Community
| Comando | Descrizione |
|---------|-------------|
| `/leaderboard xp` | Classifica XP |
| `/leaderboard profile` | Il tuo profilo |
| `/giveaway start` | Crea un giveaway (Admin) |
| `/event create` | Crea un evento (Admin) |

### Configurazione (Admin)
| Comando | Descrizione |
|---------|-------------|
| `/setup welcome` | Configura messaggi di benvenuto |
| `/setup games` | Configura canali per i giochi |
| `/dailyword setup` | Configura parola del giorno |
| `/botconfig help` | Mostra tutti i comandi |

## Struttura del Progetto

```
nihongo-bot/
├── src/
│   ├── index.ts           # Entry point
│   ├── client.ts          # Discord client setup
│   ├── config.ts          # Configurazione
│   ├── commands/          # Comandi slash
│   │   ├── games/         # Comandi giochi
│   │   ├── community/     # Giveaway, eventi, leaderboard
│   │   ├── study/         # Jisho, daily word, tracker
│   │   └── admin/         # Setup e configurazione
│   ├── events/            # Event handlers
│   ├── services/          # Business logic
│   ├── database/          # SQLite database
│   ├── utils/             # Utility functions
│   └── types/             # TypeScript types
├── data/                  # Database e dati
├── package.json
└── tsconfig.json
```

## Sistema di XP

| Azione | XP Guadagnati |
|--------|---------------|
| Messaggio | 10 XP (cooldown 60s) |
| Quiz corretto | 25 XP |
| Vittoria gioco | 50 XP |
| Studio (per minuto) | 1 XP (max 120) |

### Ruoli Livello
| Livello | Ruolo |
|---------|-------|
| 5 | 初心者 (Beginner) |
| 10 | 学生 (Student) |
| 20 | 中級者 (Intermediate) |
| 35 | 上級者 (Advanced) |
| 50 | 先輩 (Senpai) |
| 75 | 師匠 (Master) |
| 100 | 達人 (Expert) |

## Tecnologie Usate

- **Discord.js** v14 - API Discord
- **TypeScript** - Type safety
- **sql.js** - Database SQLite
- **wanakana** - Conversione hiragana/katakana
- **node-cron** - Task schedulati

## Licenza

MIT

---

頑張って! (Ganbatte!) - Buono studio! 🇯🇵
