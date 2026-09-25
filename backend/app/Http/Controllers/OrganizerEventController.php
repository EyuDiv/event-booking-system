<?php

namespace App\Http\Controllers;

use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Organizer Event Management CRUD
 *
 * All routes require:
 *   - Sanctum auth (auth:sanctum middleware)
 *   - Role check enforced per method (organizer or super-admin)
 *
 * Organizers may ONLY read / mutate events they own (organizer_id = auth user id).
 * Super-admin may access all events via a separate admin scope if needed.
 */
class OrganizerEventController extends Controller
{
    // ─── Authorization helpers ────────────────────────────────────────────────

    /**
     * Abort with 403 unless the authenticated user is an organizer or super-admin.
     */
    private function authorizeOrganizerRole(): void
    {
        $role = Auth::user()?->role;
        if (!in_array($role, ['organizer', 'super-admin'], true)) {
            abort(403, 'Access denied: organizer role required.');
        }
    }

    /**
     * Find an event and verify the authenticated organizer owns it.
     * Returns 403 for ownership failure, 404 if the event doesn't exist.
     */
    private function findOwnedEvent(int $id): Event
    {
        $event = Event::find($id);

        if (!$event) {
            abort(404, 'Event not found.');
        }

        // Super-admin can access any event; organizer only their own.
        if (Auth::user()->role !== 'super-admin' && $event->organizer_id !== Auth::id()) {
            abort(403, 'You do not have permission to manage this event.');
        }

        return $event;
    }

    // ─── Organizer Event Listing ──────────────────────────────────────────────

    /**
     * GET /api/organizer/events
     *
     * Returns all events owned by the authenticated organizer, including drafts.
     */
    public function index(): JsonResponse
    {
        try {
            $this->authorizeOrganizerRole();

            $query = Event::query();

            // Scope to organizer's own events (super-admin sees all)
            if (Auth::user()->role !== 'super-admin') {
                $query->where('organizer_id', Auth::id());
            }

            $events = $query
                ->orderByDesc('created_at')
                ->get([
                    'id',
                    'title',
                    'category',
                    'description',
                    'location',
                    'event_date',
                    'ticket_price',
                    'total_tickets',
                    'available_tickets',
                    'status',
                    'image_url',
                    'organizer_id',
                    'created_at',
                ]);

            return response()->json(['events' => $events], 200);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        } catch (Throwable $e) {
            if ($e->getCode() === 403 || $e->getCode() === 401) {
                return response()->json(['message' => $e->getMessage()], (int) $e->getCode() ?: 403);
            }
            report($e);
            return response()->json(['message' => 'Unable to load events.'], 500);
        }
    }

    // ─── Single Event Detail (organizer view, includes draft) ────────────────

    /**
     * GET /api/organizer/events/{id}
     */
    public function show(int $id): JsonResponse
    {
        try {
            $this->authorizeOrganizerRole();
            $event = $this->findOwnedEvent($id);

            return response()->json(['event' => $event], 200);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        } catch (Throwable $e) {
            $code = in_array($e->getCode(), [403, 404], true) ? (int) $e->getCode() : 500;
            if ($code !== 500) {
                return response()->json(['message' => $e->getMessage()], $code);
            }
            report($e);
            return response()->json(['message' => 'Unable to load event.'], 500);
        }
    }

    // ─── Create Event ─────────────────────────────────────────────────────────

    /**
     * POST /api/organizer/events
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $this->authorizeOrganizerRole();

            $validated = $request->validate([
                'title'          => ['required', 'string', 'max:255'],
                'category'       => ['required', 'string', 'max:100'],
                'description'    => ['nullable', 'string', 'max:5000'],
                'location'       => ['required', 'string', 'max:255'],
                'event_date'     => ['required', 'date', 'after:now'],
                'ticket_price'   => ['required', 'numeric', 'min:0'],
                'total_tickets'  => ['required', 'integer', 'min:1', 'max:100000'],
                'status'         => ['required', 'in:active,draft'],
                'image'          => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp', 'max:2048'],
            ]);

            $imageUrl = null;
            if ($request->hasFile('image')) {
                $path = $request->file('image')->store('events', 'public');
                $imageUrl = '/storage/' . $path;
            }

            $event = Event::create([
                'title'             => $validated['title'],
                'category'          => $validated['category'],
                'description'       => $validated['description'] ?? null,
                'location'          => $validated['location'],
                'event_date'        => $validated['event_date'],
                'ticket_price'      => $validated['ticket_price'],
                'total_tickets'     => $validated['total_tickets'],
                'available_tickets' => $validated['total_tickets'], // Start fully available
                'status'            => $validated['status'],
                'image_url'         => $imageUrl,
                'organizer_id'      => Auth::id(),
            ]);

            return response()->json([
                'message' => 'Event created successfully.',
                'event'   => $event,
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors'  => $e->errors(),
            ], 422);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        } catch (Throwable $e) {
            $code = in_array($e->getCode(), [403], true) ? 403 : 500;
            if ($code !== 500) {
                return response()->json(['message' => $e->getMessage()], $code);
            }
            report($e);
            return response()->json(['message' => 'Unable to create event.', 'error' => $e->getMessage()], 500);
        }
    }

    // ─── Update Event ─────────────────────────────────────────────────────────

    /**
     * PUT /api/organizer/events/{id}
     *
     * Organizers may update all fields. The available_tickets is recalculated
     * if total_tickets changes (clamped to not go below 0).
     */
    public function update(Request $request, int $id, \App\Services\NotificationService $notificationService): JsonResponse
    {
        try {
            $this->authorizeOrganizerRole();
            $event = $this->findOwnedEvent($id);

            $validated = $request->validate([
                'title'         => ['sometimes', 'required', 'string', 'max:255'],
                'category'      => ['sometimes', 'required', 'string', 'max:100'],
                'description'   => ['nullable', 'string', 'max:5000'],
                'location'      => ['sometimes', 'required', 'string', 'max:255'],
                'event_date'    => ['sometimes', 'required', 'date'],
                'ticket_price'  => ['sometimes', 'required', 'numeric', 'min:0'],
                'total_tickets' => ['sometimes', 'required', 'integer', 'min:1', 'max:100000'],
                'status'        => ['sometimes', 'required', 'in:active,draft,sold_out,cancelled'],
                'image'         => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp', 'max:2048'],
            ]);

            // Recalculate available_tickets if total_tickets changed
            if (isset($validated['total_tickets'])) {
                $soldTickets = $event->total_tickets - $event->available_tickets;
                $newAvailable = $validated['total_tickets'] - $soldTickets;
                $validated['available_tickets'] = max(0, $newAvailable);
            }

            $wasCancelled = ($validated['status'] ?? null) === 'cancelled' && $event->status !== 'cancelled';
            
            if ($request->hasFile('image')) {
                // Remove old image if exists
                if ($event->image_url && str_starts_with($event->image_url, '/storage/')) {
                    $oldPath = str_replace('/storage/', '', $event->image_url);
                    Storage::disk('public')->delete($oldPath);
                }

                $path = $request->file('image')->store('events', 'public');
                $validated['image_url'] = '/storage/' . $path;
            } elseif ($request->has('image') && $request->get('image') === null) {
                // Allow removing the image by sending image: null (if business rules allow)
                if ($event->image_url && str_starts_with($event->image_url, '/storage/')) {
                    $oldPath = str_replace('/storage/', '', $event->image_url);
                    Storage::disk('public')->delete($oldPath);
                }
                $validated['image_url'] = null;
            }

            // Remove 'image' from validated array so fill() doesn't complain (though it's not fillable anyway)
            unset($validated['image']);

            $event->fill($validated);
            $event->save();

            if ($wasCancelled) {
                $notificationService->notifyEventCancelled($event);
            } else {
                $notificationService->notifyEventUpdated($event);
            }

            return response()->json([
                'message' => 'Event updated successfully.',
                'event'   => $event->fresh(),
            ], 200);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors'  => $e->errors(),
            ], 422);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        } catch (Throwable $e) {
            $code = in_array($e->getCode(), [403, 404], true) ? (int) $e->getCode() : 500;
            if ($code !== 500) {
                return response()->json(['message' => $e->getMessage()], $code);
            }
            report($e);
            return response()->json(['message' => 'Unable to update event.'], 500);
        }
    }

    // ─── Delete Event ─────────────────────────────────────────────────────────

    /**
     * DELETE /api/organizer/events/{id}
     *
     * Only draft events with no confirmed bookings can be deleted.
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $this->authorizeOrganizerRole();
            $event = $this->findOwnedEvent($id);

            // Safety: disallow deletion if there are any confirmed bookings
            $confirmedBookings = $event->bookings()
                ->where('booking_status', 'confirmed')
                ->exists();

            if ($confirmedBookings) {
                return response()->json([
                    'message' => 'Cannot delete an event with confirmed bookings. Set the event status to draft or cancelled instead.',
                ], 422);
            }

            // Remove image if it exists
            if ($event->image_url && str_starts_with($event->image_url, '/storage/')) {
                $oldPath = str_replace('/storage/', '', $event->image_url);
                Storage::disk('public')->delete($oldPath);
            }

            $event->delete();

            return response()->json(['message' => 'Event deleted successfully.'], 200);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        } catch (Throwable $e) {
            $code = in_array($e->getCode(), [403, 404], true) ? (int) $e->getCode() : 500;
            if ($code !== 500) {
                return response()->json(['message' => $e->getMessage()], $code);
            }
            report($e);
            return response()->json(['message' => 'Unable to delete event.'], 500);
        }
    }
}
