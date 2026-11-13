import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  listUsers,
  updateUserStatus,
  deleteUser,
  reviewPayment,
  verifyAdminSession,
} from '@/lib/server-storage';

function authorized(req: NextRequest) {
  return verifyAdminSession(req.cookies.get('ala_qaddi_admin')?.value);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    const users = await listUsers();

    // Check expiration status for each user
    const now = new Date();
    const formattedUsers = users.map((u) => {
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

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    const { action, userId, status, plan, customEndDate, decision } = await req.json();

    if (action === 'review_payment' && (decision === 'confirm' || decision === 'reject')) {
      const updated = await reviewPayment(userId, decision, plan);
      return NextResponse.json({ success: true, user: updated });
    }

    if (action === 'delete') {
      await deleteUser(userId);
      return NextResponse.json({ success: true, message: 'تم حذف المستخدم' });
    }

    if (action === 'update_status') {
      const updated = await updateUserStatus(userId, status, plan, customEndDate);
      return NextResponse.json({ success: true, user: updated });
    }

    return NextResponse.json({ error: 'إجراء غير مدعوم' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
