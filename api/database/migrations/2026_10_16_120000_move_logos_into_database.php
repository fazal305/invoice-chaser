<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Hosts with ephemeral disks lose uploaded files on restart, so logos live in their own table.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_logos', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->string('mime', 32);
            $table->binary('data');
            $table->timestamps();
        });
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE user_logos MODIFY data MEDIUMBLOB NOT NULL');
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('logo_path');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('logo_path')->nullable()->after('company_name');
        });
        Schema::dropIfExists('user_logos');
    }
};
