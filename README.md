# Agent Workspace

🇬🇧 English · 🇷🇺 [Русский](README_ru.md)

A ready-made core workflow for keeping an Obsidian vault with an agent — **any** agent: Claude Code, Codex, Cursor, and others — with nobody's personal details baked in. Tasks live in `tasks.md`, your working journal in `Log/`, notes in `Notes/`, reports in `Log/Reports/`.

Agent Workspace is the main workspace an AI agent looks at to see your tasks, projects, notes, and work history. Think of it as a **superproject**: it knows about your other projects and helps you carry out complex work, even when that means gathering information or making changes in several places at once.

You talk to the agent in plain language. There are no commands to memorize, no file names to learn, no internals to understand: just ask it to show your tasks, add a new one, start working, record what happened, or put together a report.

## How to use it

### Start your day

Ask the agent:

```text
What's on my plate?
```

or:

```text
Help me pick what to work on today.
```

The agent reviews your active tasks, your current projects, and today's log, points out anything old or stalled, and helps you commit to a realistic amount of work.

### Add a task

Just say it in a sentence:

```text
Add a task: draft the client proposal.
```

You can attach a link, the original message, a ticket number, or any other context right away:

```text
Add a task: check the budget calculation.
https://example.com/task/123
```

By default a new active task goes to the end of the current week. Say where it belongs if you already know:

```text
Put it at the top of the week.
Put it in Week+.
Put it in future tasks.
Snooze it until September.
```

### Work on a task

The agent doesn't just keep the list — you can hand it the work itself:

```text
Take the first task and start working on it.
```

```text
Break this task down and tell me what you can do on your own.
```

```text
Draft the deliverable for this task using the related projects.
```

The agent gathers whatever context it can find, proposes a plan, and separates what it can finish by itself from the steps that need a human.

### Record progress

As you work, tell the agent what matters:

```text
Log this: agreed on the document structure, waiting on numbers from sales.
```

Worth putting in the daily log:

* what got done;
* what was decided;
* what you found out;
* which questions or risks came up;
* what the next step is;
* who or what the work is waiting on right now.

The log is not a mandatory detailed diary. Capturing the facts you'll need to resume the task or write a report is enough.

### Close a task

When the work is finished, say:

```text
Close the task: draft the client proposal.
```

The agent marks it done, stamps the completion date, checks the related project, and records the outcome in the daily log.

## Working rhythm

### Every day

1. Look through your active tasks.
2. Pick a small, realistic plan.
3. Work down the list from the top.
4. Write meaningful progress into the daily log.
5. Close finished tasks with a short summary.

### Every week

At the end of the week, or at the start of the next one, do two separate things:

```text
Put together the weekly report.
```

The weekly report looks **backward**: what got done, what changed, which questions and risks came up.

Then:

```text
Run the weekly review.
```

The weekly review looks **forward**: it builds a realistic plan, checks your active projects, and moves stale tasks down the ladder.

The weekly review always walks through `tasks-future.md`. Go over that list **at least once a week** so live tasks don't get forgotten in the backlog.

### Every month

In the first week of a new month, ask for:

```text
Run the monthly review.
```

The monthly review:

* collects the month's main results;
* checks active and finished projects;
* looks for projects with no next action;
* walks the deep backlog;
* promotes tasks that have become relevant;
* offers to delete or write off tasks that no longer make sense;
* produces the monthly report.

Go through `ideas.md` **at least once a month**. An idea can grow into a future task, stay a note, or be deleted once it no longer has any value.

## What the workspace looks like

```text
tasks.md
projects.md
tasks-future.md
tasks-snoozed.md
tasks-recurring.md
ideas.md

Log/
  YYYY/
    MM/
      YYYY-MM-DD.md
  Reports/
    YYYY-MM-DD.md
    YYYY-MM.md

Notes/
  YYYY/
    MM/
```

### `tasks.md` — active tasks

The main task list, the one you work with every day.

It has two parts:

* `# Week:` — tasks you genuinely plan to do this week;
* `# Week+` — near-horizon tasks that aren't part of this week's commitment yet.

Inside `# Week:`, completed tasks stay at the top and open ones sit below in the order you expect to do them. New tasks go to the end of the open list unless you explicitly ask for them higher up.

`tasks.md` should not turn into a warehouse of everything you might ever do. Only active and reasonably near-term tasks belong there.

### `projects.md` — active projects

A project is an outcome that takes more than one action to reach.

`projects.md` holds the project plan: stages, subtasks, and reference material. `tasks.md` holds only the **next concrete action** for that project.

For example, a project like:

```text
Launch the new website
```

does not belong in the weekly list as a whole. What lands in `tasks.md` is the next step:

```text
Agree on the structure of the home page
```

Once it's done, the agent proposes the project's next action.

### `tasks-future.md` — future tasks

The backlog of tasks that make sense but don't fit the near-term horizon yet.

Tasks here are grouped by topic or area. The weekly review goes through the list, promotes anything that has become relevant into `Week+` or `Week`, and may demote what has lost priority into `ideas.md` or delete it.

Go through this file **at least once a week**.

### `tasks-snoozed.md` — snoozed tasks

Tasks you need to come back to on a known date or after a certain period.

This is not a parking lot for low-priority work — it's for tasks that are too early or impossible to do right now:

* wait for a reply;
* revisit after the next release ships;
* check back in a month;
* discuss again next quarter.

When the activation date arrives, the agent offers to return the task to the active list, or to delete it if it no longer matters.

### `tasks-recurring.md` — recurring chores

Things that repeat:

* monthly checks;
* regular reports;
* keeping an eye on subscriptions and payments;
* periodic admin work.

They are never closed for good. Once done, the date is updated or the next occurrence is created for the next period.

### `ideas.md` — ideas

The bottom rung of the ladder.

This is where thoughts, opportunities, and wishes go before they become tasks. An idea may have no deadline, no commitment, and no obvious next action.

The monthly review revisits them:

* a relevant idea is promoted to `tasks-future.md`;
* one that has matured enough becomes an active task or a project;
* one that no longer makes sense is deleted.

Go through `ideas.md` **at least once a month**.

### `Log/` — daily logs

`Log/YYYY/MM/YYYY-MM-DD.md` holds the history of a single day's work.

Logs are how the agent rebuilds context:

* what you were working on;
* where you stopped;
* what was decided;
* what needs to be continued;
* why a task was put off;
* which results belong in the report.

### `Log/Reports/` — reports

Weekly and monthly summaries live here.

A weekly report usually covers:

* what got done;
* the main changes;
* questions and risks;
* next actions.

The monthly report pulls the weeks together with the state of your projects, movement on the bigger themes, and changes in the backlog.

### `Notes/` — notes and working material

`Notes/YYYY/MM/` holds documents, research, decisions, drafts, and project material.

A one-off note can be a single file. Once several related documents gather around a topic, it gets its own project or topic folder.

## The task ladder

A task's usual path looks like this:

```text
Week → Week+ → tasks-future → ideas
```

The further left a task sits, the stronger the commitment to do it soon.

* **Week** — doing it this week.
* **Week+** — planned for the foreseeable future.
* **tasks-future** — want to do it, not promising anything yet.
* **ideas** — considering it, but it's not a commitment.

Reviews move tasks in both directions. A task that has become relevant goes up. One that has stalled or lost priority goes down.

`tasks-snoozed.md` sits off to the side of this ladder: a task lands there not because its priority is low, but because there is nothing to do about it until a specific date.

## Task format

```md
# Week:

- [x] Completed task ➕ 2026-06-01 ✅ 2026-06-03
- [ ] Open task this week ➕ 2026-06-04
	- Project: [[projects]] (Project name)
	- https://example.com/task/12345
	- [ ] Check the source data
	- [ ] Prepare the deliverable

# Week+

- [ ] Longer-horizon task ➕ 2026-06-02

> Active tasks. Future ones: [[tasks-future]]. Snoozed: [[tasks-snoozed]]. Projects: [[projects]].
```

The notation:

* `➕ YYYY-MM-DD` — the date the task was created;
* `✅ YYYY-MM-DD` — the date it was completed;
* `📅 YYYY-MM-DD` — the date to come back to a snoozed task;
* the top-level checkbox — a task in its own right;
* nested checkboxes — the steps to complete it;
* plain nested bullets — links, facts, and reference context;
* the quoted line at the end of the file — the legend, linking to the rest of the ladder. It is part of the file's structure: the skills keep it in place, so don't delete it as clutter.

A task's title should describe a concrete action: a verb and an object.

Good:

```text
Check the budget calculation.
Agree on the document structure.
Request access from the administrator.
```

Too broad:

```text
Budget.
New website.
Client stuff.
```

If the outcome needs several independent actions, it's a project. Its plan moves to `projects.md`, and only the next step stays in your active tasks.

<details>
<summary>What agent skills are</summary>

A skill is a set of instructions that tells the agent how to carry out a repeated workflow in this workspace.

Separate skills help the agent, for example:

* add and close tasks;
* keep the daily log;
* break large tasks down;
* choose the day's work;
* run the weekly review;
* write weekly and monthly reports;
* check snoozed tasks;
* organize notes.

You don't have to know skill names or launch them with special commands. An ordinary request is usually enough:

```text
Add a task.
Log my progress.
Run the weekly review.
```

The agent picks the right instructions on its own.

Skills can be adapted to how a particular person or company works: folder names, project types, the services you use, and your reporting format.

</details>

## First run

> **Arrived from GitHub with nothing installed yet?**
>
> ```bash
> git clone https://github.com/popstas/obsidian-agent-workspace my-workspace
> ```
>
> Open the `my-workspace` folder as a vault in Obsidian, start an agent session in it,
> and say "adapt this vault to me".
>
> Windows, installing the Obsidian plugins, and the two other modes — into an existing
> vault, and skills only in Codex or Cursor — are covered in [INTEGRATION.md](INTEGRATION.md).

If you're reading this README inside Obsidian, an agent is most likely already setting the workspace up by following `INTEGRATION.md`.

`INTEGRATION.md` is written first and foremost for the agent. It will ask you about your projects, tasks, notes, and working tools, then adapt the system to them.

Once setup is done:

1. Ask: `What's on my plate?`
2. Add one real task from your actual work.
3. Have the agent start working on it.
4. Capture the first result in the daily log.
5. At the end of the week, put together the report and run the weekly review.

There's no need to migrate everything at once. Start with one real task and add context as you go.

Want to improve the base itself — its skills, tests, or release flow? The repository anatomy and the conventions are in [CONTRIBUTING.md](CONTRIBUTING.md).
