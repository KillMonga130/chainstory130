## **Chain Story: Complete Game Flow, Rules & Storyline**

Let me break down exactly how the game works from start to finish.

---

## **THE GAME FLOW: Minute-By-Minute**

### **HOUR 0 (Game Starts)**

**What the player sees:**

```
┌─────────────────────────────────────┐
│         📖 CHAIN STORY              │
│      Build a story, together        │
│                                     │
│  [Story] [Leaderboard] [Archive]   │
│                                     │
│  ============ CURRENT STORY ========│
│                                     │
│  [1] In a land far away...          │
│                                     │
│  📊 Story Stats:                    │
│  • Total Sentences: 1               │
│  • Total Upvotes: 0                 │
│  • Contributors: 0                  │
│  • Next Round: 4:00 PM (in 59 min)  │
│                                     │
│  ===== SUBMIT YOUR SENTENCE =====   │
│                                     │
│  [Text area - 150 char max]         │
│  "Write the next sentence..."       │
│                                     │
│  0 / 150 characters                 │
│                                     │
│  [SUBMIT SENTENCE]                  │
│                                     │
└─────────────────────────────────────┘
```

**What happens:**

- Game initializes with opening sentence: _"In a land far away..."_
- Round counter set to 1
- Timer shows: 59 minutes remaining
- Waiting for players to submit

---

### **HOURS 0-1 (Submission Phase)**

**Player A submits:**

```
"...lived a mysterious wizard."
```

**Behind the scenes:**

1. Devvit app posts comment on Reddit:
   ```
   **[Round 1]** ...lived a mysterious wizard.
   Submitted via Chain Story
   ```
2. Comment ID stored in Redis
3. UI shows: ✅ "Submitted! Your sentence is being voted on."
4. Form clears, ready for next submission

**Player B submits:**

```
"The wizard had forgotten his magic years ago."
```

**Player C submits:**

```
"One fateful morning, strange lights appeared in the sky."
```

**At 3:59 PM - One minute before round ends:**

- Player A's sentence: 5 upvotes
- Player B's sentence: 12 upvotes ⭐ (WINNING)
- Player C's sentence: 3 upvotes

---

### **HOUR 1 (4:00 PM - Round Resolution)**

**Automatic Process (Devvit Scheduled Job Triggers):**

```
⏰ Hourly Round Resolution Started

1. Fetch all comments from past 60 minutes
   ✓ Found 3 submissions

2. Find highest-voted comment
   ✓ "The wizard had forgotten his magic years ago." (12 upvotes)

3. Validate sentence
   ✓ Length: 47 characters (✅ between 10-150)
   ✓ Not offensive (✅)

4. Append to story
   ✓ Added to sentences array

5. Increment round number
   ✓ Round 1 → Round 2

6. Update total votes
   ✓ 0 + 12 = 12 total votes

7. Broadcast via real-time channel
   ✓ Sent to all connected players

✅ Round 1 Complete!
```

**What ALL players see (real-time update):**

```
🆕 NEW SENTENCE ADDED!

========== CURRENT STORY ===========

[1] In a land far away...
[2] ...lived a mysterious wizard.
[3] The wizard had forgotten his magic years ago.

📊 Story Stats:
• Total Sentences: 3
• Total Upvotes: 12
• Contributors: 3
• Round: 2 / 100
• Next Round: 5:00 PM (in 59 min)

===== SUBMIT YOUR SENTENCE =====
[Text area]
```

---

### **HOURS 1-24 (Repetition Pattern)**

**This cycle repeats every hour:**

```
Hour 2 (5:00 PM):
  [Story grows to 4 sentences]

Hour 3 (6:00 PM):
  [Story grows to 5 sentences]

Hour 4 (7:00 PM):
  [Story grows to 6 sentences]

... and so on ...

Hour 24 (Next day, 4:00 PM):
  [Story now at 25 sentences]
```

**Example of story after 24 hours:**

```
[1] In a land far away...
[2] ...lived a mysterious wizard.
[3] The wizard had forgotten his magic years ago.
[4] One fateful morning, strange lights appeared in the sky.
[5] The lights descended slowly toward his tower.
[6] He watched from his window, trembling with memories long buried.
[7] As the lights touched down, everything began to glow.
[8] The wizard stepped outside, his old staff in hand.
[9] "Who dares disturb my solitude?" he called out.
[10] From the lights emerged a figure, cloaked in silver.
[11] "Master, we've been searching for you for centuries."
[12] The wizard's eyes widened. "You're from the Order..."
[13] "Yes. And we need your help. The dark forces are rising."
[14] He looked at his trembling hands. "I'm too old. Too weak."
[15] "You're the only one strong enough to stop them," the figure said.
[16] The wizard closed his eyes, feeling the old power stirring within.
[17] Memories flooded back—battles, triumphs, terrible losses.
[18] "I thought I was done with all that," he whispered.
[19] The sky darkened suddenly, and thunder rumbled overhead.
[20] "There's no more time," the figure urged. "They're here."
[21] The wizard gripped his staff tightly, the power building.
[22] For the first time in decades, he felt alive again.
[23] The ancient magic flowed through his veins like fire.
[24] He stepped forward, ready to face whatever came next.
[25] The Order members bowed. "The battle begins at dawn."

Total Upvotes: 487
Contributors: 157 players
```

---

## **THE COMPLETE GAME RULES**

### **Submission Rules**

| Rule                | Details                                                             |
| ------------------- | ------------------------------------------------------------------- |
| **Sentence Length** | Minimum: 10 characters / Maximum: 150 characters                    |
| **Frequency**       | One sentence per player per round (can submit again next hour)      |
| **Timing**          | Submit anytime during the hour (opens at :00, closes at :59)        |
| **Format**          | Plain text, no special formatting                                   |
| **Content**         | Reddit community guidelines apply (upvotes auto-filter bad content) |
| **Duplicate**       | Same sentence twice = allowed (if community votes it highest)       |

### **Voting Rules**

| Rule                  | Details                                                      |
| --------------------- | ------------------------------------------------------------ |
| **Voting Mechanic**   | Reddit's native upvote/downvote system                       |
| **Who Votes**         | Any Reddit user viewing the game post                        |
| **Vote Weight**       | Standard Reddit algorithm (more upvotes = more visible)      |
| **Tied Scores**       | First submitted sentence wins                                |
| **Downvotes**         | Reduce net score; community filters offensive content        |
| **Vote Manipulation** | Reddit's spam detection prevents artificially inflated votes |

### **Round Resolution Rules**

| Rule                 | Details                                              |
| -------------------- | ---------------------------------------------------- |
| **Round Duration**   | Exactly 60 minutes                                   |
| **Round Start**      | Every hour at :00 UTC                                |
| **Winner Selection** | Comment with highest upvotes in past hour            |
| **Validation**       | Sentence must be 10-150 characters                   |
| **No Submissions**   | Use fallback: "The silence grew..."                  |
| **Tied Votes**       | First chronologically submitted wins                 |
| **Auto-Append**      | Top comment automatically added to story             |
| **Real-Time Update** | All players notified instantly via real-time channel |

### **Story Completion Rules**

| Rule                   | Details                                         |
| ---------------------- | ----------------------------------------------- |
| **Story Length**       | Complete after 100 sentences                    |
| **Completion Trigger** | When sentence count reaches ≥100                |
| **Lock Behavior**      | Story becomes read-only (no more submissions)   |
| **Archive Movement**   | Moved to permanent archive immediately          |
| **Notification**       | "Story Complete!" banner appears to all players |
| **Badge Award**        | Contributors receive "Story Contributor" badge  |
| **Next Story**         | New blank story auto-creates at next hour mark  |

### **Daily Reset Rules**

| Rule             | Details                                          |
| ---------------- | ------------------------------------------------ |
| **Reset Time**   | Every day at 00:00 UTC (midnight)                |
| **Active Story** | Continues (not reset, continues growing)         |
| **Leaderboard**  | Top 10 stories by votes shown on leaderboard     |
| **Archive**      | Completed stories moved to permanent archive     |
| **New Day**      | If no story active, create new one automatically |

### **Leaderboard Rules**

| Rule               | Details                                                       |
| ------------------ | ------------------------------------------------------------- |
| **Ranking**        | Top 10 stories sorted by total upvotes                        |
| **Visibility**     | Updated every 10 minutes (via Kiro agent hook)                |
| **Displayed Info** | Story ID, creator, sentence count, total votes                |
| **Tiebreaker**     | If same votes, older story ranks higher                       |
| **Archive Only**   | Completed stories shown (active story not in leaderboard yet) |
| **Refresh Rate**   | Live updates as new stories complete                          |

---

## **THE NARRATIVE ARC: How the Story Evolves**

### **Phase 1: The Hook (Sentences 1-15)**

**Purpose:** Introduce setting, character, conflict

**Typical flow:**

```
[1] Opening sentence sets scene
[2-5] Describe location/character
[6-10] Introduce conflict/mystery
[11-15] Raise stakes, create tension
```

**Example:**

```
[1] In a land far away...
[2] ...lived a mysterious wizard.
[3] The wizard had forgotten his magic years ago.
[4-6] Describe the wizard's tower, his isolation
[7-10] Strange events begin happening
[11-15] The wizard must decide: investigate or hide?
```

**Why this works:** Players naturally establish a narrative. Community voting ensures only compelling additions survive.

---

### **Phase 2: The Escalation (Sentences 16-50)**

**Purpose:** Develop plot, introduce secondary characters/conflicts

**Typical flow:**

```
[16-25] Reveal more about the conflict
[26-35] New characters/obstacles appear
[36-45] Complications arise
[46-50] Stakes increase dramatically
```

**Example:**

```
[16-20] A mysterious visitor appears at the tower
[21-25] The visitor reveals dangerous information
[26-30] The wizard must make a choice
[31-40] Adventures/challenges in the world
[41-50] The wizard discovers deeper conspiracy
```

**Community voting ensures:** Only plot developments that resonate survive to the story.

---

### **Phase 3: The Climax (Sentences 51-85)**

**Purpose:** Bring conflicts to peak, prepare resolution

**Typical flow:**

```
[51-60] Major confrontation approaches
[61-70] Allies gather, plan formed
[71-80] Execution of plan begins
[81-85] Critical moment, outcome uncertain
```

**Example:**

```
[51-60] The conspiracy is deeper than imagined
[61-70] The wizard realizes he must sacrifice
[71-80] Battle/confrontation begins
[81-85] Everything hangs in balance
```

**Why voting matters here:** Community decides if they want tragic ending, victory, or twist. Highest-voted outcomes determine path.

---

### **Phase 4: The Resolution (Sentences 86-100)**

**Purpose:** Conclude story, resolve conflicts

**Typical flow:**

```
[86-95] Outcome of climax revealed
[96-99] Loose ends tied up
[100] Final sentence/epilogue
```

**Example:**

```
[86-92] The wizard's sacrifice pays off
[93-97] Peace is restored, characters reflect
[98-99] Hint of future adventures
[100] "And so the wizard's story began anew."
```

**Completion celebration:**

- ✅ Story marked complete
- 🏆 Contributors acknowledged
- 📊 Leaderboard updated
- 🎊 New story created for next cycle

---

## **EXAMPLE COMPLETE STORY (100 Sentences)**

Here's what a finished story might look like:

```
THE WIZARD'S REDEMPTION
(Completed in 100 rounds = 100 hours of community voting)

[1] In a land far away...
[2] ...lived a mysterious wizard.
[3] The wizard had forgotten his magic years ago.
[4] One fateful morning, strange lights appeared in the sky.
[5] The lights descended slowly toward his tower.
[6] He watched from his window, trembling with memories.
[7] As the lights touched down, everything glowed with silver.
[8] The wizard stepped outside, his old staff in hand.
[9] "Who dares disturb my solitude?" he called out.
[10] From the lights emerged a figure, cloaked in silver.
...
[50] The wizard realized he couldn't run anymore.
...
[75] The two wizards faced each other, power crackling.
[76] "I was like you once," the old wizard said sadly.
[77] "Running from your past is only delaying destiny."
[78] The younger wizard lowered his staff slightly.
[79] "What if I don't want to fight?" he asked.
[80] "Then we must find another way," the elder replied.
...
[95] The two wizards joined forces to seal the darkness.
[96] The land was at peace once more.
[97] But the wizard knew peace wouldn't last forever.
[98] New threats would emerge, new heroes would be needed.
[99] The wizard smiled, feeling alive again.
[100] His journey, he realized, was just beginning.

═══════════════════════════════════════
Story Complete! 100 sentences
Total Community Upvotes: 2,847
Contributors: 342 unique players
Creator Rank: #3 on Leaderboard
═══════════════════════════════════════

✅ Story archived permanently
🎊 All contributors awarded badges
🆕 New story created, ready for next chapter
```

---

## **HOW THE GAME CREATES EMERGENT STORYTELLING**

### **Why This Works Better Than Solo Games**

**Problem with solo storytelling:** One author, predictable narrative

**Solution - Community Voting:**

- **Diversity of ideas:** 300+ players submitting different sentences each round
- **Democratic selection:** Best ideas rise via upvotes
- **Unexpected twists:** Community pushes story in directions author wouldn't
- **Engagement through ownership:** Players invested because they shaped story
- **Natural editing:** Bad ideas downvoted, never make it to story

### **Real Example - How Community Changes Direction**

**Hour 24 (Story was going:**

```
[1-24] Wizard meets Order, agrees to help them defeat dark lord
```

**Community could have voted for:**

- **Option A:** "The Order betrays the wizard" (12 upvotes)
- **Option B:** "The wizard realizes HE is the dark lord" (18 upvotes) ⭐ WINNER
- **Option C:** "The wizard declines and closes his tower" (7 upvotes)

**Result:** Story takes unexpected twist because upvotes democratically chose it.

This is what makes Chain Story brilliant—**it's crowdsourced narrative with built-in quality control (voting)**.

---

## **THE WIN CONDITION: Why Players Keep Playing**

**Players don't "win" in traditional sense. They win by:**

1. **Seeing their sentence in the official story** (permanence)
2. **Getting upvotes** (community validation)
3. **Contributing to legendary story** (100-sentence achievement)
4. **Making leaderboard** (top 10 stories ranked)
5. **Badges/recognition** (contributor status)

**Daily hooks:**

- New story starts every day
- New sentences every hour (reason to check back)
- Leaderboard competition (whose story is #1?)
- Archive browsing (reading community masterpieces)

---

## **THE COMPLETE GAME RULES SUMMARY (Quick Reference)**

```markdown
# CHAIN STORY - OFFICIAL RULES

## How to Play

1. **Read** the current story
2. **Write** a new sentence (10-150 characters)
3. **Submit** - posted as Reddit comment
4. **Vote** on sentences you like (Reddit upvotes)
5. **Win** - your sentence selected by community, added to story

## Rules

- **One sentence per player per round**
- **Sentences must be 10-150 characters**
- **Highest upvoted sentence wins each hour**
- **Story completes at 100 sentences**
- **New story starts daily**
- **Top 10 stories ranked on leaderboard**

## Rewards

- ✅ Your sentence in permanent story archive
- 🏆 Contributor badge
- 📊 Leaderboard ranking
- 🎊 Community recognition

## Important Notes

- Upvotes determine winners (Reddit community standard)
- No artificial voting manipulation allowed
- Offensive content downvoted by community
- All stories stored permanently
- Games never deleted or reset (archive permanent)

**Start writing! Your story starts now.**
```

---

**That's the complete game flow.** Players submit, community votes hourly, story grows sentence by sentence until 100 sentences completed. New story starts next day. Leaderboard tracks top community creations.

**Simple, elegant, viral.**

Now you have the complete ruleset to implement. ✅
