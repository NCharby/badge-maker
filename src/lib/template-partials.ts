/**
 * Template partials for Mustache badge rendering
 * These partials contain the reusable HTML components for badge templates
 */

export const templatePartials = {
  /**
   * Frill elements partial - decorative elements for the badge
   */
  'frill-elements': `
    {{#left}}
    <div class="frill-left" style="position: absolute; top: 0; left: 0; width: 100px; height: 100px; z-index: 1;">
      <img src="/assets/8f843d894bd14f810d7e08a72c13f91ad17c5f48.svg" alt="Left frill" style="width: 100%; height: 100%;" />
    </div>
    {{/left}}
    
    {{#right}}
    <div class="frill-right" style="position: absolute; top: 0; right: 0; width: 100px; height: 100px; z-index: 1;">
      <img src="/assets/58d534b6b91424b0cf56bd425669df37da35f4d9.svg" alt="Right frill" style="width: 100%; height: 100%;" />
    </div>
    {{/right}}
    
    {{#lower}}
    <div class="frill-lower" style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 173.873px; height: 57.019px; z-index: 1;">
      <img src="/assets/2c6cb173ab669ace01ece5b59fa70abcc55efcec.svg" alt="Lower frill" style="width: 100%; height: 100%;" />
    </div>
    {{/lower}}
  `,

  /**
   * Badge content partial - main content area with profile image, name, and social media
   */
  'badge-content': `
    <div class="badge-content" style="position: relative; z-index: 10; padding: 15px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      
      <!-- Profile Image Container -->
      <div class="profile-image-container" style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; margin-bottom: 20px; background: #333; display: flex; align-items: center; justify-content: center;">
        {{#imageUrl}}
          <img src="{{imageUrl}}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;" />
        {{/imageUrl}}
        {{^imageUrl}}
          <img src="/assets/question-placer@2x.png" alt="Question mark placeholder" style="width: 32px; height: 32px; object-contain;" />
        {{/imageUrl}}
      </div>

      <!-- Badge Name -->
      <div class="badge-name" style="text-align: center; margin-bottom: 20px;">
        <h2 style="font-family: 'Montserrat', sans-serif; font-size: 24px; color: white; margin: 0; line-height: 1.2; word-break: break-word; font-weight: normal;">
          {{badgeName}}
        </h2>
      </div>

      <!-- Social Media Handles -->
      {{#socialMediaHandles}}
        {{#platform}}
          {{^none}}
            <div class="social-handle" style="display: flex; align-items: center; gap: 10px; margin: 5px 0; padding: 5px 20px;">
              <div class="social-icon" style="width: 24px; height: 24px; flex-shrink: 0;">
                <img src="{{iconUrl}}" alt="{{platform}} icon" style="width: 100%; height: 100%;" />
              </div>
              <span style="font-family: 'Montserrat', sans-serif; font-size: 14px; color: white; white-space: nowrap;">
                {{handle}}
              </span>
            </div>
          {{/none}}
        {{/platform}}
      {{/socialMediaHandles}}

    </div>
  `
};

/**
 * Get a specific partial by name
 * @param partialName - Name of the partial to retrieve
 * @returns Partial content or empty string if not found
 */
export function getPartial(partialName: string): string {
  return templatePartials[partialName as keyof typeof templatePartials] || '';
}

/**
 * Get all available partials
 * @returns Object containing all partials
 */
export function getAllPartials(): Record<string, string> {
  return templatePartials;
}
