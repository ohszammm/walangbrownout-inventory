<?php

namespace App\Services;

use App\Support\Db;

/** Role names, permission catalogue and default grants (CCS112 Front-End Guide access matrix). */
class Perms
{
    public const ROLES = [
        'admin' => ['label' => 'System Administrator', 'motto' => 'Manages user accounts, roles, permissions and system settings.'],
        'inventory' => ['label' => 'Inventory Manager', 'motto' => 'Oversees stock accuracy, counts, adjustments and reorder planning.'],
        'purchasing' => ['label' => 'Purchasing Manager', 'motto' => 'Manages suppliers, purchase orders and stock replenishment.'],
        'warehouse' => ['label' => 'Warehouse Staff / Picker', 'motto' => 'Receives shipments, moves stock between bins and picks orders.'],
        'sales' => ['label' => 'Sales Staff', 'motto' => 'Checks product availability and creates and tracks customer orders.'],
    ];

    /** @return array<int, array{0:string,1:string,2:string,3:array<int,string>}> [key, group, label, default roles] */
    public static function catalogue(): array
    {
        $A = 'admin'; $I = 'inventory'; $P = 'purchasing'; $W = 'warehouse'; $S = 'sales';
        $ALL = [$A, $I, $P, $W, $S];
        return [
            ['dashboard.view', 'General', 'View dashboard', $ALL],
            ['inventory.view', 'Inventory', 'View inventory, search products, view stock levels', $ALL],
            ['products.write', 'Inventory', 'Add / edit products and reorder settings', [$A, $I]],
            ['products.delete', 'Inventory', 'Delete (deactivate) products', [$A, $I]],
            ['batches.view', 'Inventory', 'View batches', [$A, $I, $P, $W]],
            ['count.view', 'Inventory', 'View physical stock counts & discrepancies', [$A, $I, $W]],
            ['count.perform', 'Inventory', 'Perform physical stock count', [$W]],
            ['count.supervise', 'Inventory', 'Supervise counts, investigate & resolve discrepancies', [$I]],
            ['adjust.request', 'Inventory', 'Request stock adjustment (limited)', [$W]],
            ['adjust.approve', 'Inventory', 'Create / approve stock adjustments', [$A, $I]],
            ['movements.view', 'Shipments', 'View stock movements', [$A, $I, $W]],
            ['movements.record', 'Shipments', 'Record stock movements (transfer between bins)', [$W]],
            ['shipments.view', 'Shipments', 'View shipments', $ALL],
            ['shipments.receive', 'Shipments', 'Receive incoming shipments', [$I, $W]],
            ['shipments.process', 'Shipments', 'Pick orders & process outgoing shipments', [$W]],
            ['po.view', 'Purchasing', 'View purchase orders & purchase history', [$A, $I, $P]],
            ['po.create', 'Purchasing', 'Create / send / cancel purchase orders', [$P]],
            ['suppliers.view', 'Purchasing', 'View suppliers', [$A, $I, $P]],
            ['suppliers.manage', 'Purchasing', 'Add / edit suppliers', [$P]],
            ['reorder.view', 'Purchasing', 'View reorder suggestions', [$A, $I, $P]],
            ['alerts.view', 'Alerts', 'View low-stock, expiry & discrepancy alerts', $ALL],
            ['alerts.manage', 'Alerts', 'Acknowledge / investigate / resolve alerts', [$A, $I]],
            ['sales.view', 'Sales', 'View sales orders', [$A, $I, $S]],
            ['sales.create', 'Sales', 'Create & cancel sales orders', [$S]],
            ['reports.inventory', 'Reports', 'Inventory reports', [$A, $I]],
            ['reports.purchasing', 'Reports', 'Purchasing reports', [$A, $P]],
            ['users.manage', 'Administration', 'User management & role assignment', [$A]],
            ['roles.manage', 'Administration', 'Edit roles & permissions', [$A]],
            ['logs.view', 'Administration', 'View activity logs', [$A]],
            ['settings.manage', 'Administration', 'System settings', [$A]],
        ];
    }

    /** Grants that can never be removed (otherwise the admin could lock everybody out). */
    public const LOCKED = ['admin' => ['users.manage', 'roles.manage', 'settings.manage', 'logs.view', 'dashboard.view']];

    public static function keys(): array { return array_map(fn ($p) => $p[0], self::catalogue()); }

    private static ?array $cache = null;

    public static function flush(): void { self::$cache = null; }

    private static function load(): array
    {
        if (self::$cache === null) {
            self::$cache = [];
            foreach (Db::all('SELECT role, perm FROM role_permissions') as $r) self::$cache[$r['role']][$r['perm']] = true;
        }
        return self::$cache;
    }

    public static function roleHas(string $role, string $perm): bool { return !empty(self::load()[$role][$perm]); }

    public static function of(string $role): array
    {
        return array_values(array_filter(array_keys(self::load()[$role] ?? []), fn ($p) => in_array($p, self::keys(), true)));
    }

    public static function ensureDefaultGrants(): void
    {
        if (Db::count('SELECT COUNT(*) c FROM role_permissions') === 0) {
            foreach (self::catalogue() as [$key, , , $roles]) {
                foreach ($roles as $r) Db::run('INSERT INTO role_permissions(role, perm) VALUES (?,?)', [$r, $key]);
            }
        }
        self::flush();
    }
}
