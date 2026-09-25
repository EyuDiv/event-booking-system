<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * GET /api/notifications
     * Get paginated notifications for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $notifications = $user->notifications()->paginate(15);
        
        // Transform for frontend safety (hiding internal JSON blobs)
        $transformed = $notifications->getCollection()->map(function ($notif) {
            return [
                'id'         => $notif->id,
                'type'       => $notif->type,
                'title'      => $notif->data['title'] ?? 'Notification',
                'message'    => $notif->data['message'] ?? '',
                'read_at'    => $notif->read_at,
                'created_at' => $notif->created_at,
            ];
        });
        
        $notifications->setCollection($transformed);
        
        return response()->json([
            'notifications' => $notifications,
        ]);
    }

    /**
     * GET /api/notifications/unread-count
     */
    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    /**
     * POST /api/notifications/{id}/read
     */
    public function read(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->where('id', $id)->first();
        
        if (!$notification) {
            return response()->json(['message' => 'Notification not found.'], 404);
        }
        
        $notification->markAsRead();
        
        return response()->json(['message' => 'Notification marked as read.']);
    }

    /**
     * POST /api/notifications/read-all
     */
    public function readAll(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();
        
        return response()->json(['message' => 'All notifications marked as read.']);
    }
}
