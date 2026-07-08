import { PrismaService } from "../src/shared/config/prisma.service";

const prisma = new PrismaService();

const main = async () => {
    try {
        await prisma.specialty.deleteMany();
        const data = await prisma.specialty.createMany({
            data: [
                { specialty_code: "SP_23", specialty_name: "Dị ứng" },
                { specialty_code: "SP_21", specialty_name: "Mạch máu" },
                { specialty_code: "SP_12", specialty_name: "Tim mạch" },
                { specialty_code: "SP_18", specialty_name: "Răng Hàm Mặt" },
                { specialty_code: "SP_9", specialty_name: "Da liễu" },
                { specialty_code: "SP_22", specialty_name: "Đái tháo đường" },
                { specialty_code: "SP_10", specialty_name: "Nội tiết" },
                { specialty_code: "SP_14", specialty_name: "Tai Mũi Họng" },
                { specialty_code: "SP_5", specialty_name: "Tiêu hóa" },
                { specialty_code: "SP_1", specialty_name: "Đa khoa" },
                { specialty_code: "SP_15", specialty_name: "Phụ khoa" },
                { specialty_code: "SP_25", specialty_name: "Huyết học" },
                { specialty_code: "SP_19", specialty_name: "Truyền nhiễm" },
                { specialty_code: "SP_2", specialty_name: "Nội khoa" },
                { specialty_code: "SP_29", specialty_name: "Phẫu thuật Hàm Mặt" },
                { specialty_code: "SP_26", specialty_name: "Sơ sinh" },
                { specialty_code: "SP_24", specialty_name: "Thận học" },
                { specialty_code: "SP_17", specialty_name: "Thần kinh" },
                { specialty_code: "SP_13", specialty_name: "Ung bướu" },
                { specialty_code: "SP_7", specialty_name: "Mắt" },
                { specialty_code: "SP_6", specialty_name: "Chấn thương Chỉnh hình" },
                { specialty_code: "SP_3", specialty_name: "Nhi khoa" },
                { specialty_code: "SP_16", specialty_name: "Tâm thần" },
                { specialty_code: "SP_27", specialty_name: "Hô hấp" },
                { specialty_code: "SP_20", specialty_name: "Cơ xương khớp" },
                { specialty_code: "SP_4", specialty_name: "Ngoại khoa" },
                { specialty_code: "SP_8", specialty_name: "Chống độc" },
                { specialty_code: "SP_11", specialty_name: "Tiết niệu" },
            ]
        })

        if (data) {
            console.log("Tạo seed chuyên khoa thành công");
        } else {
            console.log("Tạo seed chuyên khoa thất bại");
        }
    } catch (error) {
        console.error("Đã xảy ra lỗi trong quá trình seed dữ liệu:", error);
    } finally {
        await prisma.$disconnect;
    }
}

main()