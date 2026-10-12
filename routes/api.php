<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PurchasingController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\StockController;
use Illuminate\Support\Facades\Route;

// All routes are prefixed with /api. ApiAuth (loads the user from the session cookie) runs on every one.
Route::prefix('auth')->group(function () {
    Route::get('health', [AuthController::class, 'health']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [AuthController::class, 'me']);
    Route::post('register', [AuthController::class, 'register']);
    Route::middleware('login')->group(function () {
        Route::patch('account', [AuthController::class, 'updateAccount']);
        Route::post('account/password', [AuthController::class, 'changePassword']);
        Route::post('account/photo', [AuthController::class, 'uploadPhoto']);
        Route::delete('account/photo', [AuthController::class, 'deletePhoto']);
        Route::get('photo/{id}', [AuthController::class, 'showPhoto'])->whereNumber('id');
    });
});

Route::prefix('admin')->controller(AdminController::class)->group(function () {
    Route::get('users', 'users')->middleware('perm:users.manage');
    Route::post('users', 'createUser')->middleware('perm:users.manage');
    Route::patch('users/{id}', 'updateUser')->middleware('perm:users.manage')->whereNumber('id');
    Route::post('users/{id}/reset-password', 'resetPassword')->middleware('perm:users.manage')->whereNumber('id');
    Route::get('roles', 'roles')->middleware('perm:roles.manage');
    Route::put('roles/{role}/permissions', 'setRolePermissions')->middleware('perm:roles.manage');
    Route::get('logs', 'logs')->middleware('perm:logs.view');
    Route::get('settings', 'settings')->middleware('perm:settings.manage');
    Route::put('settings', 'updateSettings')->middleware('perm:settings.manage');
});

Route::controller(CatalogController::class)->group(function () {
    Route::get('availability', 'availability')->middleware('perm:inventory.view');
    Route::get('products', 'products')->middleware('perm:inventory.view');
    Route::get('products/{sku}', 'product')->middleware('perm:inventory.view');
    Route::post('products', 'createProduct')->middleware('perm:products.write');
    Route::put('products/{id}', 'updateProduct')->middleware('perm:products.write')->whereNumber('id');
    Route::delete('products/{id}', 'deleteProduct')->middleware('perm:products.delete')->whereNumber('id');
    Route::get('batches', 'batches')->middleware('perm:batches.view');
    Route::get('batches/{id}', 'batch')->middleware('perm:batches.view')->whereNumber('id');
    Route::get('movements', 'movements')->middleware('perm:movements.view');
    Route::post('movements/transfer', 'transfer')->middleware('perm:movements.record');
});

Route::controller(StockController::class)->group(function () {
    Route::get('counts', 'counts')->middleware('perm:count.view');
    Route::get('counts/worksheet', 'worksheet')->middleware('perm:count.view');
    Route::post('counts', 'storeCount')->middleware('perm:count.perform');
    Route::post('counts/{id}/investigate', 'investigate')->middleware('perm:count.supervise')->whereNumber('id');
    Route::post('counts/{id}/resolve', 'resolve')->middleware('perm:count.supervise')->whereNumber('id');
    Route::get('adjustments', 'adjustments')->middleware('perm:adjust.approve,adjust.request');
    Route::post('adjustments', 'storeAdjustment')->middleware('perm:adjust.approve,adjust.request');
    Route::post('adjustments/{id}/approve', 'approve')->middleware('perm:adjust.approve')->whereNumber('id');
    Route::post('adjustments/{id}/reject', 'reject')->middleware('perm:adjust.approve')->whereNumber('id');
    Route::get('alerts', 'alerts')->middleware('perm:alerts.view');
    Route::post('alerts/state', 'alertState')->middleware('perm:alerts.manage');
});

Route::controller(OrderController::class)->group(function () {
    Route::get('sales-orders', 'index')->middleware('perm:sales.view');
    Route::get('sales-orders/{id}', 'show')->middleware('perm:sales.view')->whereNumber('id');
    Route::post('sales-orders', 'store')->middleware('perm:sales.create');
    Route::post('sales-orders/{id}/cancel', 'cancel')->middleware('perm:sales.create')->whereNumber('id');
    Route::get('pick-orders', 'pickOrders')->middleware('perm:shipments.process');
    Route::post('pick-orders/{id}/start', 'startPick')->middleware('perm:shipments.process')->whereNumber('id');
    Route::post('pick-orders/{id}/complete', 'completePick')->middleware('perm:shipments.process')->whereNumber('id');
    Route::get('outgoing', 'outgoing')->middleware('perm:shipments.view');
    Route::post('outgoing/{id}/ship', 'ship')->middleware('perm:shipments.process')->whereNumber('id');
});

Route::controller(PurchasingController::class)->group(function () {
    Route::get('reorder', 'reorder')->middleware('perm:reorder.view');
    Route::get('suppliers', 'suppliers')->middleware('perm:suppliers.view');
    Route::get('suppliers/{id}', 'supplier')->middleware('perm:suppliers.view')->whereNumber('id');
    Route::post('suppliers', 'createSupplier')->middleware('perm:suppliers.manage');
    Route::put('suppliers/{id}', 'updateSupplier')->middleware('perm:suppliers.manage')->whereNumber('id');
    Route::get('purchase-orders', 'purchaseOrders')->middleware('perm:po.view');
    Route::get('purchase-orders/{id}', 'purchaseOrder')->middleware('perm:po.view')->whereNumber('id');
    Route::post('purchase-orders', 'createPurchaseOrder')->middleware('perm:po.create');
    Route::post('purchase-orders/{id}/send', 'sendPurchaseOrder')->middleware('perm:po.create')->whereNumber('id');
    Route::post('purchase-orders/{id}/cancel', 'cancelPurchaseOrder')->middleware('perm:po.create')->whereNumber('id');
    Route::get('purchase-history', 'purchaseHistory')->middleware('perm:po.view');
    Route::get('incoming', 'incoming')->middleware('perm:shipments.view');
    Route::get('incoming/{id}', 'incomingOne')->middleware('perm:shipments.view')->whereNumber('id');
    Route::post('incoming/{id}/receive', 'receive')->middleware('perm:shipments.receive')->whereNumber('id');
});

Route::get('dashboard', [DashboardController::class, 'dashboard'])->middleware('perm:dashboard.view');
Route::get('badges', [DashboardController::class, 'badges']);
Route::get('reports', [ReportController::class, 'index']);
Route::get('reports/{group}/{key}', [ReportController::class, 'show']);
