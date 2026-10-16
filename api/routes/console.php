<?php

use Illuminate\Support\Facades\Schedule;

// Hourly so each user's reminders go out soon after the send hour in their own timezone.
Schedule::command('chase:run')->hourly()->withoutOverlapping(30);

Schedule::command('queue:prune-failed --hours=720')->daily();
Schedule::command('sanctum:prune-expired --hours=24')->daily();
