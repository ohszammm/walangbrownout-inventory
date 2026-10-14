<?php

namespace App\Support;

use Exception;

/** An error that is sent to the client as {"error": message, ...extra} with the given status. */
class HttpError extends Exception
{
    public function __construct(public int $status, string $message, public array $extra = [])
    {
        parent::__construct($message);
    }

    public static function bad(string $m, array $x = []): self { return new self(400, $m, $x); }
    public static function forbidden(string $m = 'You do not have permission to do that.'): self { return new self(403, $m); }
    public static function notFound(string $m = 'Not found'): self { return new self(404, $m); }
    public static function conflict(string $m, array $x = []): self { return new self(409, $m, $x); }
}
