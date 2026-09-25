<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        $users = $query->orderBy('created_at', 'desc')->paginate($request->get('per_page', 15));

        return response()->json([
            'users' => $users
        ]);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json([
            'user' => $user
        ]);
    }

    public function updateRole(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'role' => 'required|in:customer,organizer,super-admin'
        ]);

        // Prevent removing the last super-admin
        if ($user->role === 'super-admin' && $validated['role'] !== 'super-admin') {
            $superAdminCount = User::where('role', 'super-admin')->count();
            if ($superAdminCount <= 1) {
                return response()->json(['message' => 'Cannot change role of the last super-admin.'], 403);
            }
        }

        $user->role = $validated['role'];
        $user->save();

        return response()->json([
            'message' => 'User role updated successfully.',
            'user' => $user
        ]);
    }
}
