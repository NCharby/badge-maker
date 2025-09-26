-- Fix the COG Classic template to remove duplicate frills
-- The template should only call {{> badge-content }} and let the partial handle frills internally

UPDATE public.templates 
SET config = '<div class="bg-gradient-to-b box-border content-stretch flex from-[#0f2733] from-[0.214%] gap-2.5 items-center justify-start p-[15px] relative size-full to-[#170a2a] to-[99.748%] rounded-[10px] w-[284px] h-[400px] scale-100 sm:w-[320px] sm:h-[450px] sm:scale-110 md:w-[355px] md:h-[500px] md:scale-125 lg:w-[390px] lg:h-[550px] lg:scale-140" data-name="Badge">{{> badge-content }}</div>'
WHERE id = 'cog-classic-2026';

-- Verify the template is correct
SELECT 
  id, 
  name, 
  config
FROM public.templates 
WHERE id = 'cog-classic-2026';

