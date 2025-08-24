export function ProgressSteps() {
  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="bg-[#111111] rounded-[10px] w-full px-10 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-[#2d2d2d] flex flex-col items-center justify-center px-6 py-8 rounded-[20px] text-white text-center min-h-[200px]">
            <div className="font-montserrat font-black text-[80px] leading-none mb-4">
              1
            </div>
            <div className="font-montserrat font-normal text-2xl">
              Basic Details
            </div>
          </div>
          <div className="bg-[#2d2d2d] flex flex-col items-center justify-center px-6 py-8 rounded-[20px] text-white text-center min-h-[200px]">
            <div className="font-montserrat font-black text-[80px] leading-none mb-4">
              2
            </div>
            <div className="font-montserrat font-normal text-2xl">
              Review Waiver
            </div>
          </div>
          <div className="bg-[#2d2d2d] flex flex-col items-center justify-center px-6 py-8 rounded-[20px] text-white text-center min-h-[200px]">
            <div className="font-montserrat font-black text-[80px] leading-none mb-4">
              3
            </div>
            <div className="font-montserrat font-normal text-2xl">
              Create Badge
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
