<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserLogo extends Model
{
    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $fillable = ['user_id', 'mime', 'data'];

    protected $hidden = ['data'];
}
