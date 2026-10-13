<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('email')->unique();
            $t->string('password_hash');
            $t->string('role', 20);
            $t->string('status', 20)->default('active');
            $t->string('created_at', 40)->nullable();
            $t->string('last_login', 40)->nullable();
            $t->unsignedInteger('fails')->default(0);
            $t->unsignedBigInteger('locked_until')->default(0);
        });
        Schema::create('api_sessions', function (Blueprint $t) {
            $t->string('token_hash', 64)->primary();
            $t->unsignedBigInteger('user_id')->index();
            $t->unsignedBigInteger('expires');
        });
        Schema::create('role_permissions', function (Blueprint $t) {
            $t->string('role', 20);
            $t->string('perm', 60);
            $t->primary(['role', 'perm']);
        });
        Schema::create('settings', function (Blueprint $t) {
            $t->string('skey', 60)->primary();
            $t->string('value');
        });
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->string('ts', 30)->nullable();
            $t->unsignedBigInteger('user_id')->nullable();
            $t->string('user_name')->nullable();
            $t->string('role', 20)->nullable();
            $t->string('action', 60)->nullable();
            $t->text('detail')->nullable();
        });
        Schema::create('suppliers', function (Blueprint $t) {
            $t->id();
            $t->string('code', 20)->nullable()->unique();
            $t->string('name');
            $t->string('contact')->nullable();
            $t->string('email')->nullable();
            $t->string('phone', 40)->nullable();
            $t->unsignedInteger('lead_time_days')->default(14);
            $t->string('status', 20)->default('active');
            $t->text('notes')->nullable();
        });
        Schema::create('products', function (Blueprint $t) {
            $t->id();
            $t->string('sku', 40)->unique();
            $t->string('name');
            $t->string('category', 80);
            $t->string('class', 1)->default('B');
            $t->unsignedTinyInteger('perishable')->default(0);
            $t->unsignedInteger('shelf_life_days')->nullable();
            $t->unsignedTinyInteger('seasonal')->default(0);
            $t->unsignedTinyInteger('season_start')->nullable();
            $t->unsignedTinyInteger('season_end')->nullable();
            $t->double('season_mult')->default(1);
            $t->double('avg_daily_usage')->default(1);
            $t->unsignedInteger('lead_time')->default(7);
            $t->unsignedInteger('safety_stock')->default(0);
            $t->unsignedInteger('max_stock')->default(100);
            $t->double('unit_cost')->default(0);
            $t->double('price')->default(0);
            $t->unsignedBigInteger('supplier_id')->nullable();
            $t->string('bin', 20)->nullable();
            $t->unsignedTinyInteger('active')->default(1);
        });
        Schema::create('batches', function (Blueprint $t) {
            $t->id();
            $t->string('code', 30)->unique();
            $t->unsignedBigInteger('product_id')->index();
            $t->integer('qty');
            $t->string('received', 12);
            $t->string('expiry', 12)->nullable();
            $t->string('bin', 20)->nullable();
            $t->unsignedBigInteger('po_id')->nullable();
        });
        Schema::create('movements', function (Blueprint $t) {
            $t->id();
            $t->string('ts', 30);
            $t->unsignedBigInteger('product_id')->index();
            $t->unsignedBigInteger('batch_id')->nullable()->index();
            $t->string('batch_code', 30)->nullable();
            $t->string('type', 20);
            $t->integer('qty');
            $t->string('ref')->nullable();
            $t->unsignedBigInteger('user_id')->nullable();
            $t->string('user_name')->nullable();
            $t->text('note')->nullable();
        });
        Schema::create('counts', function (Blueprint $t) {
            $t->id();
            $t->string('code', 20)->unique();
            $t->unsignedBigInteger('product_id')->index();
            $t->integer('system_qty');
            $t->integer('physical_qty');
            $t->string('status', 20);
            $t->string('counted_by')->nullable();
            $t->string('ts', 30)->nullable();
            $t->text('note')->nullable();
            $t->string('assigned_to')->nullable();
            $t->text('resolution')->nullable();
            $t->string('resolved_by')->nullable();
            $t->string('resolved_ts', 30)->nullable();
        });
        Schema::create('adjustments', function (Blueprint $t) {
            $t->id();
            $t->string('code', 20)->unique();
            $t->unsignedBigInteger('product_id')->index();
            $t->unsignedBigInteger('batch_id')->nullable();
            $t->integer('delta');
            $t->text('reason');
            $t->string('status', 20);
            $t->string('requested_by')->nullable();
            $t->string('ts', 30)->nullable();
            $t->string('decided_by')->nullable();
            $t->string('decided_ts', 30)->nullable();
            $t->text('decision_note')->nullable();
        });
        Schema::create('purchase_orders', function (Blueprint $t) {
            $t->id();
            $t->string('code', 20)->unique();
            $t->unsignedBigInteger('supplier_id');
            $t->string('status', 20);
            $t->string('created_by')->nullable();
            $t->string('created', 30)->nullable();
            $t->string('expected', 12)->nullable();
            $t->text('notes')->nullable();
        });
        Schema::create('po_items', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('po_id')->index();
            $t->unsignedBigInteger('product_id');
            $t->integer('qty');
            $t->double('unit_cost')->default(0);
            $t->integer('received_qty')->default(0);
        });
        Schema::create('incoming', function (Blueprint $t) {
            $t->id();
            $t->string('code', 20)->unique();
            $t->unsignedBigInteger('po_id')->index();
            $t->string('expected_date', 12);
            $t->string('status', 20);
            $t->string('received_date', 12)->nullable();
            $t->string('received_by')->nullable();
            $t->text('note')->nullable();
        });
        Schema::create('sales_orders', function (Blueprint $t) {
            $t->id();
            $t->string('code', 20)->unique();
            $t->string('customer');
            $t->string('phone', 40)->nullable();
            $t->string('address')->nullable();
            $t->string('status', 20);
            $t->string('created_by')->nullable();
            $t->string('created', 30)->nullable();
            $t->string('shipped', 30)->nullable();
            $t->text('note')->nullable();
        });
        Schema::create('so_items', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('so_id')->index();
            $t->unsignedBigInteger('product_id');
            $t->integer('qty');
            $t->double('price')->default(0);
        });
        Schema::create('so_picks', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('so_id')->index();
            $t->unsignedBigInteger('product_id');
            $t->unsignedBigInteger('batch_id')->nullable();
            $t->string('batch_code', 30)->nullable();
            $t->integer('qty');
            $t->string('bin', 20)->nullable();
        });
        Schema::create('alert_states', function (Blueprint $t) {
            $t->string('akey', 80)->primary();
            $t->string('state', 20);
            $t->string('by_user')->nullable();
            $t->string('ts', 30)->nullable();
            $t->text('note')->nullable();
        });
    }

    public function down(): void
    {
        foreach (['alert_states', 'so_picks', 'so_items', 'sales_orders', 'incoming', 'po_items', 'purchase_orders', 'adjustments', 'counts', 'movements', 'batches', 'products', 'suppliers', 'audit_logs', 'settings', 'role_permissions', 'api_sessions', 'users'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
