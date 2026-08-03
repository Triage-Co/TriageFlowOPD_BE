const servicesData = [
  {
    service_code: "KHAM_NOI_01",
    service_name: "Khám nội tổng quát",
    price: 2500,
    service_type: "CLINICAL_EXAMINATION",
    room_type: "CLINICAL_ROOM",
    is_active: true
  },
  {
    service_code: "KHAM_NGOAI_01",
    service_name: "Khám ngoại khoa",
    price: 2500,
    service_type: "CLINICAL_EXAMINATION",
    room_type: "CLINICAL_ROOM",
    is_active: true
  },
  {
    service_code: "KHAM_NHI_01",
    service_name: "Khám nhi khoa",
    price: 2500,
    service_type: "CLINICAL_EXAMINATION",
    room_type: "CLINICAL_ROOM",
    is_active: true
  },
  {
    service_code: "KHAM_SAN_01",
    service_name: "Khám sản phụ khoa",
    price: 3000,
    service_type: "CLINICAL_EXAMINATION",
    room_type: "CLINICAL_ROOM",
    is_active: true
  },
  {
    service_code: "KHAM_TMH_01",
    service_name: "Khám Tai Mũi Họng",
    price: 3000,
    service_type: "CLINICAL_EXAMINATION",
    room_type: "CLINICAL_ROOM",
    is_active: true
  },
  {
    service_code: "KHAM_MAT_01",
    service_name: "Khám mắt toàn diện",
    price: 2800,
    service_type: "CLINICAL_EXAMINATION",
    room_type: "CLINICAL_ROOM",
    is_active: true
  },
  {
    service_code: "KHAM_RHM_01",
    service_name: "Khám Răng Hàm Mặt",
    price: 2500,
    service_type: "CLINICAL_EXAMINATION",
    room_type: "CLINICAL_ROOM",
    is_active: true
  },
  {
    service_code: "XN_MAU_CB",
    service_name: "Xét nghiệm máu cơ bản",
    price: 2200,
    service_type: "DIAGNOSTIC_TEST",
    room_type: "LABORATORY",
    is_active: true
  },
  {
    service_code: "XN_SH_MAU",
    service_name: "Xét nghiệm sinh hóa máu",
    price: 3500,
    service_type: "DIAGNOSTIC_TEST",
    room_type: "LABORATORY",
    is_active: true
  },
  {
    service_code: "XN_NUOC_TIEU",
    service_name: "Xét nghiệm nước tiểu",
    price: 2000,
    service_type: "DIAGNOSTIC_TEST",
    room_type: "LABORATORY",
    is_active: true
  },
  {
    service_code: "CD_XQUANG_01",
    service_name: "Chụp X-quang phổi thẳng",
    price: 2500,
    service_type: "DIAGNOSTIC_TEST",
    room_type: "IMAGING_ROOM",
    is_active: true
  },
  {
    service_code: "CD_SIEUAM_01",
    service_name: "Siêu âm ổ bụng tổng quát",
    price: 3000,
    service_type: "DIAGNOSTIC_TEST",
    room_type: "IMAGING_ROOM",
    is_active: true
  },
  {
    service_code: "CD_MRI_01",
    service_name: "Chụp MRI sọ não",
    price: 4000,
    service_type: "DIAGNOSTIC_TEST",
    room_type: "IMAGING_ROOM",
    is_active: true
  },
  {
    service_code: "CN_DIENTIM",
    service_name: "Đo điện tâm đồ (ECG)",
    price: 2000,
    service_type: "DIAGNOSTIC_TEST",
    room_type: "FUNCTIONAL_EXPLORATION",
    is_active: true
  },
  {
    service_code: "CN_HOHAP",
    service_name: "Đo chức năng hô hấp",
    price: 2500,
    service_type: "DIAGNOSTIC_TEST",
    room_type: "FUNCTIONAL_EXPLORATION",
    is_active: true
  },
  {
    service_code: "TT_KHAU_VT",
    service_name: "Khâu vết thương phần mềm",
    price: 3500,
    service_type: "PROCEDURE",
    room_type: "PROCEDURE_ROOM",
    is_active: true
  },
  {
    service_code: "TT_THAY_BANG",
    service_name: "Thay băng, cắt chỉ",
    price: 2000,
    service_type: "PROCEDURE",
    room_type: "PROCEDURE_ROOM",
    is_active: true
  },
  {
    service_code: "TT_NOISOI_DD",
    service_name: "Nội soi dạ dày tá tràng",
    price: 3800,
    service_type: "PROCEDURE",
    room_type: "PROCEDURE_ROOM",
    is_active: true
  },
  {
    service_code: "TT_NHO_RANG",
    service_name: "Nhổ răng tiểu phẫu",
    price: 4000,
    service_type: "PROCEDURE",
    room_type: "PROCEDURE_ROOM",
    is_active: true
  },
  {
    service_code: "TT_TIEM_BAP",
    service_name: "Tiêm bắp/tĩnh mạch",
    price: 2000,
    service_type: "PROCEDURE",
    room_type: "PROCEDURE_ROOM",
    is_active: true
  },
  {
    service_code: "KEDON_01",
    service_name: "Tư vấn và kê đơn thuốc",
    price: 2000,
    service_type: "PRESCRIPTION",
    room_type: "CLINICAL_ROOM",
    is_active: true
  },
  {
    service_code: "CAP_THUOC_BH",
    service_name: "Cấp phát thuốc BHYT",
    price: 0,
    service_type: "PRESCRIPTION",
    room_type: "PHARMACY",
    is_active: true
  }
];

// await prisma.service.createMany({ data: servicesData });