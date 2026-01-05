import { Client, ActivityType } from "discord.js";
import type { Event } from "../types/index.js";
import { startScheduledTasks } from "../services/scheduler.js";

/**
 * Ready event - fired when the bot successfully connects to Discord
 */
const ready: Event = {
  name: "ready",
  once: true,
  async execute(client: Client) {
    if (!client.user) return;

    console.log("");
    console.log("╔════════════════════════════════════════════╗");
    console.log("║       NihongoHub Bot - Ready!              ║");
    console.log("╠════════════════════════════════════════════╣");
    console.log(`║  Logged in as: ${client.user.tag.padEnd(26)}║`);
    console.log(`║  Guilds: ${String(client.guilds.cache.size).padEnd(33)}║`);
    console.log(`║  Users: ${String(client.users.cache.size).padEnd(34)}║`);
    console.log("╚════════════════════════════════════════════╝");
    console.log("");

    // Set bot activity/status - cycle between different emojis
    const activities = ["👈(ﾟヮﾟ👈)", "(👉ﾟヮﾟ)👉", "👈(⌒▽⌒)👉"];
    let activityIndex = 0;

    // Set initial activity
    client.user.setActivity(activities[activityIndex], {
      type: ActivityType.Playing,
    });

    // Cycle through activities every 10 seconds
    setInterval(() => {
      if (!client.user) return;
      activityIndex = (activityIndex + 1) % activities.length;
      client.user.setActivity(activities[activityIndex], {
        type: ActivityType.Playing,
      });
    }, 10000);

    // Start scheduled tasks (daily word, giveaway checker, etc.)
    startScheduledTasks(client);

    console.log("[Ready] Bot is fully operational!");
  },
};

export default ready;
