<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\RefundRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminRefundController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = RefundRequest::with(['booking:id,user_id,event_id', 'booking.user:id,name,email', 'booking.event:id,title']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $refunds = $query->orderBy('created_at', 'desc')->paginate($request->get('per_page', 15));

        return response()->json([
            'refunds' => $refunds
        ]);
    }
}
