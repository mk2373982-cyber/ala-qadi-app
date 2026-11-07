import { NextResponse } from 'next/server';
import { getSystemData, updateUserStatus, deleteUser, UserAccount } from '@/lib/server-storage';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    // Simple admin check
    const data = getSystemData();

    // Check expiration status for each user
    const now = new Date();
    const formattedUsers = data.users.map((u) => {
      let currentStatus = u.status;
      if (currentStatus === 'active' && u.endDate) {
        if (now > new Date(u.endDate)) {
          currentStatus = 'expired';
        }
      }
      return {
        ...u,
        status: currentStatus,
      };
    });

    // Stats
    const totalUsers = formattedUsers.length;
    const activeUsers = formattedUsers.filter((u) => u.status === 'active').length;
    const pendingUsers = formattedUsers.filter((u) => u.status === 'pending').length;
    const expiredUsers = formattedUsers.filter((u) => u.status === 'expired').length;
    const suspendedUsers = formattedUsers.filter((u) => u.status === 'suspended').length;

    return NextResponse.json({
      users: formattedUsers,
      stats: {
        totalUsers,
        activeUsers,
        pendingUsers,
        expiredUsers,
        suspendedUsers,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { action, userId, status, plan, customEndDate } = await req.json();

    if (action === 'delete') {
      deleteUser(userId);
      return NextResponse.json({ success: true, message: 'تم حذف المستخدم' });
    }

    if (action === 'update_status') {
      const updated = updateUserStatus(userId, status, plan, customEndDate);
      return NextResponse.json({ success: true, user: updated });
    }

    return NextResponse.json({ error: 'إجراء غير مدعوم' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
