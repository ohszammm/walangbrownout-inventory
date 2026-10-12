<?php

namespace Database\Seeders;

use App\Services\Perms;
use App\Support\Clock;
use App\Support\Db;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    private function iso(int $daysAgo): string
    {
        return gmdate('Y-m-d\TH:i:s.000\Z', time() - $daysAgo * 86400);
    }

    private function ts(int $daysAgo, string $hh = '09:15:00'): string
    {
        return Clock::addDays(Clock::today(), -$daysAgo) . ' ' . $hh;
    }

    public function run(): void
    {
        Db::tx(function () {
            Perms::ensureDefaultGrants();
            $pw = Hash::make('password');
            $today = Clock::today();
            $add = fn ($n) => Clock::addDays($today, $n);

            $users = [
                ['Samuel Moro', 'admin', 'admin', 'active', 90], ['Cornelio Maño', 'inventory', 'inventory', 'active', 80],
                ['Desiree Morasa', 'purchasing', 'purchasing', 'active', 75], ['Jan Cedric Nuqui', 'warehouse', 'warehouse', 'active', 60],
                ['Cholo Ordonia', 'sales', 'sales', 'active', 45],
            ];
            foreach ($users as [$name, $e, $role, $status, $age]) {
                Db::run('INSERT INTO users(name,email,password_hash,role,status,created_at,last_login) VALUES (?,?,?,?,?,?,?)',
                    [$name, "$e@walangbrownout.test", $pw, $role, $status, $this->iso($age), $this->iso(intdiv($age, 30))]);
            }
            Db::run('INSERT INTO users(name,email,password_hash,role,status,created_at) VALUES (?,?,?,?,?,?)', ['Former Intern', 'intern@walangbrownout.test', $pw, 'warehouse', 'disabled', $this->iso(200)]);
            Db::run('INSERT INTO users(name,email,password_hash,role,status,created_at) VALUES (?,?,?,?,?,?)', ['Paolo Garcia', 'paolo@example.com', $pw, 'sales', 'pending', $this->iso(2)]);

            $sup = [
                ['SUP-001', 'Cool Air Trading Co.', 'Ramon Uy', 'orders@coolair.example', '+63 2 8555 0101', 14],
                ['SUP-002', 'PureFlow Filters Inc.', 'Dana Cheng', 'sales@pureflow.example', '+63 2 8555 0202', 7],
                ['SUP-003', 'SmartHome Devices PH', 'Kyle Tan', 'b2b@smarthome.example', '+63 2 8555 0303', 21],
                ['SUP-004', 'Metro Parts Supply', 'Iris Bautista', 'hello@metroparts.example', '+63 2 8555 0404', 5],
            ];
            foreach ($sup as $s) Db::run('INSERT INTO suppliers(code,name,contact,email,phone,lead_time_days) VALUES (?,?,?,?,?,?)', $s);

            $P = [
                ['ACU-1000', 'Portable Air Conditioner 1.0HP', 'Portable AC', 'A', 0, null, 1, 4, 7, 4, 3, 14, 12, 700, 14500, 19990, 1, 'A-04'],
                ['ACU-1500', 'Portable Air Conditioner 1.5HP', 'Portable AC', 'A', 0, null, 1, 4, 7, 4, 2, 14, 10, 400, 18900, 24990, 1, 'A-05'],
                ['APU-300', 'HEPA Air Purifier 300', 'Air Purifier', 'B', 0, null, 0, null, null, 1, 4, 10, 15, 300, 3800, 5490, 4, 'B-02'],
                ['APU-500', 'HEPA Air Purifier 500 Pro', 'Air Purifier', 'B', 0, null, 0, null, null, 1, 2, 10, 8, 150, 6900, 9490, 4, 'B-03'],
                ['FLT-F023', 'Replacement Filter F-023', 'Filter', 'B', 1, 270, 0, null, null, 1, 6, 7, 20, 500, 380, 690, 2, 'C-01'],
                ['FLT-H100', 'HEPA Replacement Filter H-100', 'Filter', 'C', 1, 270, 0, null, null, 1, 3, 7, 10, 300, 520, 890, 2, 'C-02'],
                ['THM-2200', 'Smart Thermostat v2', 'Smart Thermostat', 'A', 0, null, 0, null, null, 1, 2, 21, 10, 200, 2400, 3990, 3, 'D-01'],
                ['ACC-REM', 'AC Remote Controller (universal)', 'Accessory', 'C', 0, null, 0, null, null, 1, 1, 5, 10, 200, 150, 349, 4, 'D-07'],
            ];
            foreach ($P as $p) {
                Db::run('INSERT INTO products(sku,name,category,class,perishable,shelf_life_days,seasonal,season_start,season_end,season_mult,avg_daily_usage,lead_time,safety_stock,max_stock,unit_cost,price,supplier_id,bin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', $p);
            }
            $pid = fn ($sku) => (int) Db::get('SELECT id FROM products WHERE sku = ?', [$sku])['id'];

            $B = [
                ['ACU-1000', 'B-3391', 18, 98, null, 'A-04'], ['ACU-1500', 'B-3410', 55, 120, null, 'A-05'], ['ACU-1500', 'B-3522', 64, 30, null, 'A-06'],
                ['APU-300', 'B-3101', 48, 40, null, 'B-02'], ['FLT-F023', 'B-2105', 10, 285, -12, 'C-01'], ['FLT-F023', 'B-2207', 30, 250, 15, 'C-01'], ['FLT-F023', 'B-2311', 90, 20, 250, 'C-01'],
                ['FLT-H100', 'B-2290', 140, 60, 210, 'C-02'], ['THM-2200', 'B-4001', 25, 70, null, 'D-01'], ['THM-2200', 'B-4012', 20, 35, null, 'D-01'], ['ACC-REM', 'B-5001', 260, 50, null, 'D-07'],
            ];
            foreach ($B as [$sku, $code, $qty, $rec, $exp, $bin]) {
                Db::run('INSERT INTO batches(code,product_id,qty,received,expiry,bin) VALUES (?,?,?,?,?,?)', [$code, $pid($sku), $qty, $add(-$rec), $exp === null ? null : $add($exp), $bin]);
            }
            $bid = fn ($c) => (int) Db::get('SELECT id FROM batches WHERE code = ?', [$c])['id'];

            // Mystery Shrinkage: spreadsheet says 45, physical count found 12
            Db::run('INSERT INTO counts(code,product_id,system_qty,physical_qty,status,counted_by,ts,note) VALUES (?,?,?,?,?,?,?,?)', ['CNT-0001', $pid('THM-2200'), 45, 12, 'open', 'Jan Cedric Nuqui', $this->ts(1, '16:40:00'), 'Bin D-01 nearly empty; counted twice.']);
            Db::run('INSERT INTO counts(code,product_id,system_qty,physical_qty,status,counted_by,ts,resolution,resolved_ts) VALUES (?,?,?,?,?,?,?,?,?)', ['CNT-0002', $pid('APU-300'), 48, 48, 'resolved', 'Jan Cedric Nuqui', $this->ts(6), 'Matches system', $this->ts(6)]);

            $po = function ($code, $s, $status, $days, $exp, $items, $by = 'Desiree Morasa') use ($pid) {
                $id = Db::run('INSERT INTO purchase_orders(code,supplier_id,status,created_by,created,expected) VALUES (?,?,?,?,?,?)', [$code, $s, $status, $by, $this->ts($days), $exp]);
                foreach ($items as $it) {
                    [$sku, $q] = $it;
                    Db::run('INSERT INTO po_items(po_id,product_id,qty,unit_cost,received_qty) VALUES (?,?,?,?,?)', [$id, $pid($sku), $q, Db::get('SELECT unit_cost c FROM products WHERE sku = ?', [$sku])['c'], $it[2] ?? 0]);
                }
                return $id;
            };
            $p1 = $po('PO-0001', 1, 'sent', 16, $add(-3), [['ACU-1000', 120]]);
            $p2 = $po('PO-0002', 2, 'sent', 8, $today, [['FLT-F023', 100]]);
            $p3 = $po('PO-0003', 4, 'received', 25, $add(-12), [['APU-300', 50, 48]]);
            $po('PO-0004', 3, 'draft', 1, $add(21), [['THM-2200', 60]]);
            $p5 = $po('PO-0005', 2, 'received', 60, $add(-50), [['FLT-H100', 150, 150]]);
            $inc = fn ($code, $p, $exp, $st, $rd, $by) => Db::run('INSERT INTO incoming(code,po_id,expected_date,status,received_date,received_by) VALUES (?,?,?,?,?,?)', [$code, $p, $exp, $st, $rd, $by]);
            $inc('SHP-0001', $p1, $add(-3), 'delayed', null, null);
            $inc('SHP-0002', $p2, $today, 'expected', null, null);
            $inc('SHP-0003', $p3, $add(-12), 'variance', $add(-11), 'Jan Cedric Nuqui');
            $inc('SHP-0004', $p5, $add(-50), 'received', $add(-50), 'Jan Cedric Nuqui');

            $so = function ($code, $cust, $status, $days, $items, $shipped = null) use ($pid) {
                $id = Db::run('INSERT INTO sales_orders(code,customer,phone,address,status,created_by,created,shipped) VALUES (?,?,?,?,?,?,?,?)',
                    [$code, $cust, '+63 917 555 01' . substr($code, -2), 'Quezon City, Metro Manila', $status, 'Cholo Ordonia', $days === 0 ? Clock::nowTs() : $this->ts($days), $shipped]);
                foreach ($items as [$sku, $q]) {
                    Db::run('INSERT INTO so_items(so_id,product_id,qty,price) VALUES (?,?,?,?)', [$id, $pid($sku), $q, Db::get('SELECT price c FROM products WHERE sku = ?', [$sku])['c']]);
                }
                return $id;
            };
            $pick = fn ($s, $sku, $code, $q) => Db::run('INSERT INTO so_picks(so_id,product_id,batch_id,batch_code,qty,bin) VALUES (?,?,?,?,?,?)', [$s, $pid($sku), $bid($code), $code, $q, Db::get('SELECT bin FROM batches WHERE code = ?', [$code])['bin']]);
            $s1 = $so('SO-0001', 'Hotel Aurora', 'shipped', 12, [['ACU-1500', 2]], $this->ts(10));
            $pick($s1, 'ACU-1500', 'B-3410', 2);
            $so('SO-0002', 'Mercado Home Center', 'pending', 0, [['APU-300', 3], ['FLT-F023', 10]]);
            $so('SO-0003', 'Santos Residence', 'picking', 1, [['FLT-F023', 5]]);
            $s4 = $so('SO-0004', 'Lim Dental Clinic', 'ready', 1, [['ACU-1500', 1]]);
            $pick($s4, 'ACU-1500', 'B-3410', 1);
            $so('SO-0005', 'Walk-in customer', 'cancelled', 4, [['ACC-REM', 2]]);

            $mv = fn ($d, $sku, $code, $type, $qty, $ref, $who, $note = null) => Db::run('INSERT INTO movements(ts,product_id,batch_id,batch_code,type,qty,ref,user_name,note) VALUES (?,?,?,?,?,?,?,?,?)',
                [$this->ts($d, '10:05:00'), $pid($sku), $code ? $bid($code) : null, $code, $type, $qty, $ref, $who, $note]);
            $mv(98, 'ACU-1000', 'B-3391', 'Received', 22, 'PO-0000', 'Jan Cedric Nuqui');
            $mv(50, 'THM-2200', 'B-4001', 'Received', 25, 'PO-0009', 'Jan Cedric Nuqui');
            $mv(40, 'APU-300', 'B-3101', 'Received', 48, 'SHP-0003 / PO-0003', 'Jan Cedric Nuqui', 'expected 50');
            $mv(20, 'FLT-F023', 'B-2311', 'Received', 90, 'PO-0010', 'Jan Cedric Nuqui');
            $mv(12, 'ACU-1500', 'B-3410', 'Picked', -2, 'SO-0001', 'Jan Cedric Nuqui');
            $mv(10, 'ACU-1500', 'B-3410', 'Shipped', 2, 'SO-0001', 'Jan Cedric Nuqui');
            $mv(6, 'APU-300', null, 'Counted', 48, 'CNT-0002', 'Jan Cedric Nuqui', 'system 48');
            $mv(5, 'ACC-REM', 'B-5001', 'Transferred', 260, 'D-03 → D-07', 'Jan Cedric Nuqui');
            $mv(3, 'THM-2200', 'B-4012', 'Adjusted', -2, 'ADJ-0001', 'Cornelio Maño', 'Damaged in handling');
            $mv(1, 'THM-2200', null, 'Counted', 12, 'CNT-0001', 'Jan Cedric Nuqui', 'system 45');
            $mv(1, 'ACU-1500', 'B-3410', 'Picked', -1, 'SO-0004', 'Jan Cedric Nuqui');
            Db::run('INSERT INTO adjustments(code,product_id,delta,reason,status,requested_by,ts,decided_by,decided_ts) VALUES (?,?,?,?,?,?,?,?,?)', ['ADJ-0001', $pid('THM-2200'), -2, 'Damaged in handling', 'approved', 'Jan Cedric Nuqui', $this->ts(3), 'Cornelio Maño', $this->ts(3)]);
            Db::run('INSERT INTO adjustments(code,product_id,delta,reason,status,requested_by,ts) VALUES (?,?,?,?,?,?,?)', ['ADJ-0002', $pid('FLT-F023'), -10, 'Dispose expired batch B-2105', 'pending', 'Jan Cedric Nuqui', $this->ts(0, '08:30:00')]);

            foreach ([[30, 'Samuel Moro', 'USER_CREATE', 'warehouse@walangbrownout.test as warehouse'], [14, 'Samuel Moro', 'ROLE_ASSIGN', 'sales@walangbrownout.test: warehouse → sales'], [6, 'Samuel Moro', 'USER_DISABLE', 'intern@walangbrownout.test: active → disabled'], [2, 'Paolo Garcia', 'REGISTER', 'paolo@example.com requested access (pending approval)']] as [$d, $who, $action, $detail]) {
                Db::run('INSERT INTO audit_logs(ts,user_name,action,detail) VALUES (?,?,?,?)', [$this->ts($d), $who, $action, $detail]);
            }
        });
    }
}
