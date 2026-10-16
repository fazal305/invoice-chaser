<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chase_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->foreignId('chase_step_id')->nullable()->constrained()->nullOnDelete();
            $table->string('channel', 8);
            $table->string('recipient')->nullable();
            $table->string('status', 16);
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->string('provider_message_id')->nullable();
            $table->date('scheduled_for');
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->string('error_message', 500)->nullable();
            $table->timestamps();

            $table->unique(['invoice_id', 'chase_step_id']);
            $table->index(['status', 'updated_at']);
            $table->index('provider_message_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chase_logs');
    }
};
