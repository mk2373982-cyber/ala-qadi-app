import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  listUsers,
  updateUserStatus,
  deleteUser,
  resetUserPassword,
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
  } catch (error) {
    console.error('Listing users failed:', error);
    return NextResponse.json(
      { error: 'تعذر تحميل بيانات المستخدمين. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    const { action, userId, status, plan, customEndDate, decision, newPassword } = await req.json();

    if (action === 'review_payment' && (decision === 'confirm' || decision === 'reject')) {
      const updated = await reviewPayment(userId, decision, plan);
      return NextResponse.json({ success: true, user: updated });
    }

    if (action === 'reset_password') {
      // Explicit 400 for bad input so the admin sees an actionable message;
      // resetUserPassword re-validates before hashing.
      if (
        typeof newPassword !== 'string' ||
        newPassword.trim().length < 8 ||
        newPassword.length > 128
      ) {
        return NextResponse.json(
          { error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل و128 كحد أقصى.' },
          { status: 400 },
        );
      }
      const updated = await resetUserPassword(userId, newPassword);
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
  } catch (error) {
    console.error('Admin user action failed:', error);
    return NextResponse.json({ error: 'تعذر تنفيذ الإجراء. حاول مرة أخرى.' }, { status: 500 });
  }
}
