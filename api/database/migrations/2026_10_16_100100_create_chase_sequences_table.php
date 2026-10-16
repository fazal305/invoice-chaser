<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chase_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'is_default']);
        });

        Schema::create('chase_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('chase_sequence_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('days_offset');
            $table->string('trigger_type', 16);
            $table->string('channel', 8);
            $table->string('subject')->nullable();
            $table->text('template_body');
            $table->timestamps();

            $table->unique(['chase_sequence_id', 'trigger_type', 'days_offset', 'channel'], 'chase_steps_timing_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chase_steps');
        Schema::dropIfExists('chase_sequences');
    }
};
