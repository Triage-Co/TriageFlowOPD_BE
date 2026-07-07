import { error } from 'console';
import { PrismaService } from '../src/shared/config/prisma.service';
import { SupabaseService } from '../src/shared/config/supabase.service';

const prismaService = new PrismaService();
const supabaseService = new SupabaseService();
export const Account = async () => {
  try {
    const supaAdmin = await supabaseService.getClient().auth.signUp({
      email: 'admin@gmail.com',
      password: '123456',
      options: {
        data: {
          user_name: 'admin',
          gender: 'MALE',
          role: 'ADMIN',
        },
      },
    });

    if (!supaAdmin || !supaAdmin.data || !supaAdmin.data.user) {
      throw error;
    }

    await supabaseService
      .getClient()
      .auth.admin.updateUserById(supaAdmin.data.user?.id, {
        email_confirm: true,
      });

    await prismaService.account.create({
      data: {
        account_id: supaAdmin.data.user?.id,
        email: 'admin@gmail.com',
        user_name: 'admin',
        gender: 'MALE',
        role: 'ADMIN',
      },
    });

    console.log('Tạo tài khoảng admin thành công');
  } catch (error) {
    console.error('Tạo người dùng không thành công');
  }
};

Account();
