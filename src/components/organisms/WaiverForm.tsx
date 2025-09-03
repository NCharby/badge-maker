'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { Card } from '@/components/atoms/card';
import { DateOfBirthInput } from '@/components/molecules/DateOfBirthInput';
import { PhoneInput } from '@/components/molecules/PhoneInput';
import { SignatureCapture } from '@/components/molecules/SignatureCapture';
import { useRouter } from 'next/navigation';
import { useUserFlowStore } from '@/hooks/useUserFlowStore';

interface WaiverFormProps {
  eventSlug: string;
}

export function WaiverForm({ eventSlug }: WaiverFormProps) {
  const router = useRouter();
  const { 
    email, 
    firstName, 
    lastName, 
    dateOfBirth, 
    dietaryRestrictions,
    dietaryRestrictionsOther,
    volunteeringInterests,
    additionalNotes,
    emergencyContact, 
    emergencyPhone, 
    signature, 
    hasReadTerms,
    setWaiverData,
    setSignature,
    setHasReadTerms,
    setWaiverId
  } = useUserFlowStore();
  
  const [formData, setFormData] = useState({
    firstName: firstName || '',
    lastName: lastName || '',
    email: email || '',
    dateOfBirth: dateOfBirth || new Date('2000-01-01'),
    emergencyContact: emergencyContact || '',
    emergencyPhone: emergencyPhone || '',
    signature: signature,
    dietaryRestrictions: dietaryRestrictions || [],
    dietaryRestrictionsOther: dietaryRestrictionsOther || '',
    volunteeringInterests: volunteeringInterests || [],
    additionalNotes: additionalNotes || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [showValidation, setShowValidation] = useState(false);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.dateOfBirth || isNaN(formData.dateOfBirth.getTime())) {
      errors.dateOfBirth = 'Date of birth is required';
    }
    
    if (!formData.emergencyContact.trim()) {
      errors.emergencyContact = 'Emergency contact is required';
    }
    
    if (!formData.emergencyPhone.trim()) {
      errors.emergencyPhone = 'Emergency phone is required';
    }
    
    if (!hasReadTerms) {
      errors.terms = 'You must read and agree to the terms';
    }
    
    if (!formData.signature) {
      errors.signature = 'Digital signature is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

               const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          setShowValidation(true);
          
          if (!validateForm()) {
            return;
          }

          setIsSubmitting(true);
          
          try {
            // Prepare waiver data for PDF generation
            const waiverData = {
              firstName: formData.firstName,
              lastName: formData.lastName,
              email: formData.email,
              dateOfBirth: formData.dateOfBirth.toISOString().split('T')[0], // Format as YYYY-MM-DD
              emergencyContact: formData.emergencyContact,
              emergencyPhone: formData.emergencyPhone,
              signatureImage: formData.signature,
              sessionId: null, // We'll implement session management later
              dietaryRestrictions: formData.dietaryRestrictions || [],
              dietaryRestrictionsOther: formData.dietaryRestrictionsOther || null,
              volunteeringInterests: formData.volunteeringInterests || [],
              additionalNotes: formData.additionalNotes || null
            };

            // Call PDF generation API
            const response = await fetch('/api/pdf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(waiverData),
            });

            const result = await response.json();

            if (!response.ok) {
              throw new Error(result.error || 'Failed to generate PDF');
            }

            // Update Zustand store with waiver data (dietary/volunteering data comes from landing page)
            setWaiverData({
              emergencyContact: formData.emergencyContact,
              emergencyPhone: formData.emergencyPhone,
              signature: formData.signature,
              hasReadTerms: hasReadTerms,
            });

            // Set the waiver ID for badge linking
            if (result.waiverId) {
              setWaiverId(result.waiverId);
            }

            console.log('PDF generated successfully:', result);
            
            // Navigate to badge creation
            router.push(`/${eventSlug}/badge-creator`);
            
          } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
          } finally {
            setIsSubmitting(false);
          }
        };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4 font-montserrat">
          Event Waiver & Terms of Service
        </h1>
        <p className="text-lg text-gray-300 mb-2">
          Please review and sign the waiver to continue to badge creation
        </p>
        <p className="text-sm text-gray-400">
          Fields marked with <span className="text-red-400">*</span> are required
        </p>
      </div>

             <form onSubmit={handleSubmit} className="space-y-8">
        {/* Terms of Service Section */}
        <Card className="p-6 bg-[#111111] border-[#5c5c5c]">
          <h2 className="text-2xl font-semibold text-white mb-6 font-montserrat">
            Terms of Service & Event Waiver
          </h2>
          
                     <div className="bg-[#2d2d2d] p-6 rounded-lg max-h-96 overflow-y-auto mb-6">
             <div className="text-white text-sm space-y-4 font-open-sans">
               <p>
                 Upon attending any event hosted by Shiny Dog Productions INC, you affirm your understanding of and consent to the subsequent conditions, which encompass grounds for potential removal or prohibition:
               </p>
               
               <ol className="list-decimal list-inside space-y-2 ml-4">
                 <li><strong>Excessive Drunkenness</strong>: Acknowledgment that excessive alcohol consumption leading to disruptive or unsafe behavior jeopardizes the safety and enjoyment of other attendees and staff.</li>
                 <li><strong>Unwanted Sexual Advances</strong>: Understanding that engaging in unwelcome sexual advances, comments, or behavior that makes other participants uncomfortable or violated is strictly prohibited.</li>
                 <li><strong>Failure to Respect Consent</strong>: Recognition that personal boundaries, consent, and the right to revoke consent at any time must be upheld at all times.</li>
                 <li><strong>Destructive Behavior to Venue</strong>: Agreement that actions resulting in damage, defacement, or destruction of the event venue's property are not tolerated.</li>
                 <li><strong>Destructive Behavior to Self</strong>: Acknowledgment of the prohibition against actions that pose harm to oneself or others, including behaviors leading to injury or self-endangerment.</li>
                 <li><strong>Destructive Behavior to Other Attendees or Their Belongings</strong>: Understanding that causing harm to other participants, their personal property, or belongings is strictly prohibited.</li>
                 <li><strong>Excessive Noise</strong>: Acknowledgment of the responsibility to avoid creating excessive noise that disrupts the event environment or neighboring areas.</li>
                 <li><strong>Disrespecting Staff</strong>: Understanding that displaying disrespectful behavior or language towards event staff, volunteers, or organizers is not acceptable.</li>
                 <li><strong>Not Respecting Play Space Etiquette</strong>: Agreement to adhere to established guidelines and rules for respectful behavior within designated play spaces.</li>
                 <li><strong>Illegal Drug Use</strong>: Acknowledgment that possession, use, or distribution of illegal substances during the event is strictly prohibited.</li>
               </ol>

               <h3 className="text-lg font-semibold mt-6">MPX/MONKEY POX & COVID RELEASE</h3>
               <p>
                 I release and hold harmless Shiny Dog Productions INC including but not limited to any of their agents, owners and/or employees for any MPX and/or COVID-19/(Novel) Corona Virus claims as they relate to my time on the property.
               </p>
               <p>
                 Monkeypox and COVID-19 can be a serious disease. By entering the event, you are at your own risk and fully aware of all risks associated with Monkeypox and COVID-19.
               </p>

               <h3 className="text-lg font-semibold mt-6">EQUIPMENT & PLAY AREA USAGE</h3>
               <p>
                 I understand that various pieces of equipment, benches, etc. have been made available for my use during this event. I agree that I will not use any piece of equipment that I am not familiar with unless and until I have sought and obtained proper instruction in its safe use.
               </p>

               <h3 className="text-lg font-semibold mt-6">ASSUMPTION OF RISK</h3>
               <p>
                 I understand and acknowledge that all activities at this event have inherent dangers that no amount of care, caution, preparation, or expertise can eliminate, and I expressly and voluntarily assume all risk of harm of any kind, including but not limited to emotional harm, personal injury, infection, disease, or death sustained as a result of participating in this event, whether or not caused by the negligence of the organizers or host venues.
               </p>
               <p className="font-bold">
                 I VOLUNTARILY ASSUME ALL RISK, KNOWN AND UNKNOWN, OF INJURIES HOWEVER CAUSED, WHILE ON THE PREMISES, WHETHER USING THE FACILITIES OR NOT, EVEN IF CAUSED IN WHOLE OR IN PART BY THE ACTION, INACTION, OR NEGLIGENCE OF THE ORGANIZERS TO THE FULLEST EXTENT ALLOWED BY LAW.
               </p>

               <h3 className="text-lg font-semibold mt-6">PERSONAL INFORMATION</h3>
               <p>
                 I, the undersigned, hereby provide the following personal information and confirm that all details are accurate and complete:
               </p>
               
               <div className="space-y-4 mt-4">
                                                     <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-2">
                      <Label className="text-white font-montserrat text-sm">
                        First Name <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        placeholder="Enter your first name"
                        className={`bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] text-sm ${
                          showValidation && validationErrors.firstName ? 'border-red-500' : ''
                        }`}
                        required
                      />
                      {showValidation && validationErrors.firstName && (
                        <p className="text-red-400 text-xs mt-1">{validationErrors.firstName}</p>
                      )}
                    </div>
                    
                    <div className="flex flex-col space-y-2">
                      <Label className="text-white font-montserrat text-sm">
                        Last Name <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        placeholder="Enter your last name"
                        className={`bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] text-sm ${
                          showValidation && validationErrors.lastName ? 'border-red-500' : ''
                        }`}
                        required
                      />
                      {showValidation && validationErrors.lastName && (
                        <p className="text-red-400 text-xs mt-1">{validationErrors.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label className="text-white font-montserrat text-sm">
                      Email Address <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="Enter your email address"
                      className={`bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] text-sm ${
                        showValidation && validationErrors.email ? 'border-red-500' : ''
                      }`}
                      required
                    />
                    {showValidation && validationErrors.email && (
                      <p className="text-red-400 text-xs mt-1">{validationErrors.email}</p>
                    )}
                  </div>

                  <div className="flex flex-col space-y-2">
                    <DateOfBirthInput 
                      value={formData.dateOfBirth}
                      onChange={(date) => handleInputChange('dateOfBirth', date)}
                      error={showValidation && validationErrors.dateOfBirth ? validationErrors.dateOfBirth : undefined}
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label className="text-white font-montserrat text-sm">
                      Emergency Contact <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={formData.emergencyContact}
                      onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                      placeholder="Emergency contact name"
                      className={`bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] text-sm ${
                        showValidation && validationErrors.emergencyContact ? 'border-red-500' : ''
                      }`}
                    />
                    {showValidation && validationErrors.emergencyContact && (
                      <p className="text-red-400 text-xs mt-1">{validationErrors.emergencyContact}</p>
                    )}
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label className="text-white font-montserrat text-sm">
                      Emergency Phone <span className="text-red-400">*</span>
                    </Label>
                    <PhoneInput
                      label=""
                      value={formData.emergencyPhone}
                      onChange={(value) => handleInputChange('emergencyPhone', value)}
                      placeholder="Emergency contact phone"
                      defaultCountry="US"
                      className={showValidation && validationErrors.emergencyPhone ? 'border-red-500' : ''}
                    />
                    {showValidation && validationErrors.emergencyPhone && (
                      <p className="text-red-400 text-xs mt-1">{validationErrors.emergencyPhone}</p>
                    )}
                  </div>
               </div>
             </div>
           </div>

          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="readTerms"
                checked={hasReadTerms}
                onChange={(e) => {
                  setHasReadTerms(e.target.checked);
                  if (validationErrors.terms) {
                    setValidationErrors(prev => ({ ...prev, terms: '' }));
                  }
                }}
                className="w-4 h-4 text-blue-600 bg-transparent border-[#5c5c5c] rounded focus:ring-blue-500"
              />
              <Label htmlFor="readTerms" className="text-white font-montserrat">
                I have read, understood, and agree to the Terms of Service and Event Waiver
              </Label>
            </div>
            {showValidation && validationErrors.terms && (
              <p className="text-red-400 text-xs ml-7">{validationErrors.terms}</p>
            )}
          </div>
        </Card>

        {/* Validation Summary */}
        {showValidation && Object.keys(validationErrors).length > 0 && (
          <Card className="p-4 bg-red-900/20 border-red-500">
            <div className="text-red-300">
              <h3 className="font-semibold mb-2">Please fix the following errors:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {Object.values(validationErrors).map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </Card>
        )}

        {/* Signature Section */}
        <Card className="p-6 bg-[#111111] border-[#5c5c5c]">
          <h2 className="text-2xl font-semibold text-white mb-6 font-montserrat">
            Digital Signature
          </h2>
          
          <div className="space-y-4">
            <p className="text-gray-300">
              Please provide your digital signature below to confirm your agreement to the terms and conditions.
            </p>
            
            <SignatureCapture
              value={formData.signature}
              onChange={(signature) => {
                handleInputChange('signature', signature);
                setSignature(signature);
              }}
              isFormValid={!isSubmitting && hasReadTerms && !!formData.signature && !!formData.firstName && !!formData.lastName && !!formData.email && !!formData.emergencyContact && !!formData.emergencyPhone && formData.dateOfBirth && !isNaN(formData.dateOfBirth.getTime())}
              onSubmit={() => {
                const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                handleSubmit(fakeEvent);
              }}
              isSubmitting={isSubmitting}
            />
            
            {showValidation && validationErrors.signature && (
              <p className="text-red-400 text-xs mt-1">{validationErrors.signature}</p>
            )}
          </div>
        </Card>



       </form>
    </div>
  );
}
