<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('company_name');
            $table->string('logo_path')->nullable();
            $table->string('timezone', 64)->default('UTC');
            $table->char('currency', 3)->default('USD');
            $table->unsignedSmallInteger('payment_terms_days')->default(30);
            $table->string('payment_url', 2048)->nullable();
            $table->text('payment_instructions')->nullable();
            $table->string('reply_to_email')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
