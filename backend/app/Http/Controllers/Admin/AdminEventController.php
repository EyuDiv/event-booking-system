<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminEventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Event::with('organizer:id,name,email');

        if ($request->filled('search')) {
            $query->where('title', 'like', '%' . $request->search . '%');
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        $events = $query->orderBy('created_at', 'desc')->paginate($request->get('per_page', 15));

        return response()->json([
            'events' => $events
        ]);
    }

    public function show(Event $event): JsonResponse
    {
        $event->load('organizer:id,name,email');
        return response()->json([
            'event' => $event
        ]);
    }

    public function updateStatus(Request $request, Event $event): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:active,draft,sold_out,cancelled'
        ]);

        $wasCancelled = $validated['status'] === 'cancelled' && $event->status !== 'cancelled';

        $event->status = $validated['status'];
        $event->save();

        if ($wasCancelled) {
            // Trigger cancellation workflow
            $notificationService = app(\App\Services\Notification\NotificationService::class);
            $notificationService->notifyEventCancelled($event);
        }

        return response()->json([
            'message' => 'Event status updated successfully.',
            'event' => $event
        ]);
    }
}
