# Scratchpad - Piano di Implementazione

## Background and Motivation

L'utente richiede un comando admin per gestire i livelli e l'XP degli utenti. Attualmente il sistema di livelli permette solo di aggiungere XP attraverso l'interazione normale (messaggi, giochi, etc.), ma non c'è un modo per gli amministratori di modificare manualmente i livelli o l'XP degli utenti.

Questo comando è utile per:
- Correggere errori o problemi con l'XP degli utenti
- Assegnare ricompense speciali
- Impostare livelli specifici per eventi o promozioni
- Gestire casi particolari

## Key Challenges and Analysis

### 1. Struttura del Database
- Attualmente `userSchema.updateXp()` aggiunge XP e ricalcola automaticamente il livello
- Manca un metodo per settare XP o livello direttamente
- Il livello viene calcolato con: `level = Math.floor(Math.sqrt(xp / 100)) + 1`
- L'XP per un livello è: `xp = (level - 1)^2 * 100` (già implementato in `xpForLevel()`)

### 2. Gestione dei Ruoli di Livello
- Il sistema ha ruoli di livello che vengono assegnati automaticamente
- Quando si modifica manualmente un livello, bisogna aggiornare anche i ruoli
- La funzione `updateLevelRoles()` nel level-service gestisce questo

### 3. Permessi
- Il comando deve essere accessibile solo agli admin
- Usare `checkAdminPermission()` come negli altri comandi admin

### 4. Interfaccia Utente
- Usare subcommands per organizzare le azioni (add, set-level, set-xp, remove)
- Fornire feedback chiaro con embed
- Mostrare il prima/dopo quando si modifica XP o livello

## High-level Task Breakdown

### Task 1: Aggiungere metodi al database schema
**Descrizione**: Estendere `userSchema` con metodi per settare XP e livello direttamente.

**Success Criteria**:
- Metodo `setXp(id: string, xp: number): User` che imposta XP e ricalcola il livello
- Metodo `setLevel(id: string, level: number): User` che imposta il livello e calcola l'XP necessario
- I metodi devono funzionare correttamente con la formula di calcolo esistente
- Test manuale: verificare che XP e livello siano aggiornati correttamente nel database

**File da modificare**: `src/database/schema.ts`

### Task 2: Creare il comando admin `/xpmanage`
**Descrizione**: Creare un nuovo comando slash con subcommands per gestire XP e livelli.

**Success Criteria**:
- Comando `/xpmanage` con permessi admin (`ManageGuild`)
- Subcommand `add`: aggiunge XP a un utente (può essere negativo per rimuovere)
- Subcommand `set-level`: imposta un livello specifico
- Subcommand `set-xp`: imposta XP direttamente
- Tutti i subcommands richiedono un utente (User option) e mostrano feedback con embed
- Il comando aggiorna anche i ruoli di livello quando necessario
- Test manuale: eseguire tutti i subcommands e verificare che funzionino correttamente

**File da creare**: `src/commands/admin/xpmanage.ts`

### Task 3: Registrare il comando
**Descrizione**: Aggiungere il nuovo comando all'index dei comandi.

**Success Criteria**:
- Il comando è importato in `src/commands/index.ts`
- Il comando è aggiunto all'array `commands`
- Test: verificare che il comando appaia in Discord dopo il deploy

**File da modificare**: `src/commands/index.ts`

### Task 4: Integrazione con aggiornamento ruoli
**Descrizione**: Assicurarsi che quando si modifica XP/livello, i ruoli vengano aggiornati.

**Success Criteria**:
- Quando si modifica XP/livello, chiamare `updateLevelRoles()` se l'utente è nel server
- Gestire errori se il bot non può modificare i ruoli
- Test manuale: modificare livello e verificare che i ruoli vengano aggiornati

**File da modificare**: `src/commands/admin/xpmanage.ts`

## Project Status Board

- [x] Task 1: Aggiungere metodi al database schema ✅
- [x] Task 2: Creare il comando admin `/xpmanage` ✅
- [x] Task 3: Registrare il comando ✅
- [x] Task 4: Integrazione con aggiornamento ruoli ✅

## Current Status / Progress Tracking

**Stato attuale**: ✅ IMPLEMENTAZIONE COMPLETATA

Tutti i task sono stati completati con successo:

1. **Task 1**: Aggiunti metodi `setXp()` e `setLevel()` al `userSchema` in `src/database/schema.ts`
   - `setXp()` imposta XP direttamente e ricalcola il livello
   - `setLevel()` imposta il livello e calcola l'XP necessario usando la formula: `xp = (level - 1)^2 * 100`

2. **Task 2**: Creato il comando `/xpmanage` in `src/commands/admin/xpmanage.ts`
   - Subcommand `add`: aggiunge/rimuove XP (valori negativi supportati)
   - Subcommand `set-level`: imposta un livello specifico
   - Subcommand `set-xp`: imposta XP direttamente
   - Tutti i subcommands mostrano feedback con embed che includono valori prima/dopo
   - Aggiornamento automatico dei ruoli di livello incluso

3. **Task 3**: Comando registrato in `src/commands/index.ts`
   - Import aggiunto
   - Comando aggiunto all'array `commands`

4. **Task 4**: Integrazione ruoli già implementata nel Task 2
   - Chiamata a `updateLevelRoles()` dopo ogni modifica di XP/livello
   - Gestione errori per utenti non presenti nel server

**Prossimi passi**: 
- Test manuale del comando su Discord
- Deploy del comando (se necessario, eseguire script di deploy)
- Verifica che i ruoli vengano aggiornati correttamente

### Manutenzione (2026-01-22)
- **Motivo**: Il typecheck falliva con errori TS6133 (import/funzioni non usati) dopo aver disabilitato l’XP in alcuni moduli di gioco/eventi.
- **Azione**: Rimossi gli import `awardXp`/`userSchema` non più usati e resa `awardMessageXp()` una funzione esportata (così resta disponibile per riattivare l’XP senza rompere il build).

## Executor's Feedback or Assistance Requests

**Implementazione completata con successo!**

Il comando `/xpmanage` è pronto per essere testato. Tutte le funzionalità sono state implementate secondo il piano:
- Permessi admin verificati
- Feedback utente con embed informativi
- Aggiornamento automatico dei ruoli di livello
- Gestione errori appropriata

**Nota tecnica**: Il comando importa `xpForLevel` dal level-service ma non lo usa direttamente (il calcolo è già nel database schema). L'import può essere rimosso in futuro se necessario, ma non causa problemi.

**Richiesta**: Dopo queste modifiche, eseguire il typecheck (`npm run check-types`) per confermare che gli errori TS6133 siano risolti.

**Aggiornamento**: In questo repo lo script corretto è `npm run build` (esegue `tsc`). Il comando ora passa senza errori.

## Lessons

- Il livello viene calcolato con: `level = Math.floor(Math.sqrt(xp / 100)) + 1`
- L'XP per un livello specifico è: `xp = (level - 1)^2 * 100` (implementato in `xpForLevel()`)
- I comandi admin usano `checkAdminPermission()` per verificare i permessi
- I ruoli di livello vengono gestiti da `updateLevelRoles()` nel level-service
- I comandi admin richiedono `PermissionFlagsBits.ManageGuild` di default
