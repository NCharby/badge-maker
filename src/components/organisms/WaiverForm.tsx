'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { Card } from '@/components/atoms/card';
import { DateOfBirthInput } from '@/components/molecules/DateOfBirthInput';
import { PhoneInput } from '@/components/molecules/ShadcnPhoneInput';
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
              additionalNotes: formData.additionalNotes || null,
              eventSlug: eventSlug
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
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-8">
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
        <Card className="p-3 sm:p-6 bg-[#111111] border-[#5c5c5c]">

          
                     <div className="bg-[#2d2d2d] p-3 sm:p-6 rounded-lg max-h-96 overflow-y-auto mb-6">
             <div className="text-white text-sm space-y-4 font-open-sans">
               <h2 className="text-lg font-semibold text-white font-montserrat">Shiny Dog Productions Release of Liability</h2>
               
               <p>
                 I am or will be over 21 years of age as of the first day of the start of the event. A government-issued photo id is required for verification at registration.
               </p>

               <p>
                 <strong>Email hello@shinydogproductions.com for anything</strong><br/>
                 All refund requests and absentee notifications must be sent to hello@shinydogproductions.com to be honored. No other forms of communication will be accepted. (i.e. Telegram, Text or Verbal)
               </p>

               <hr className="border-[#5c5c5c]"/>

               <p>
                 I am freely and voluntarily choosing to attend and participate in this event and to view and/or participate in activities that I know are adult-oriented and sexually explicit.
               </p>

               <p>
                 I am aware that such activities involve acts of domination, submission, bondage, discipline, sadism and masochism, and other explicit and extreme sexual fetishes including, but not limited to, spanking, paddling, whipping, suspension, fisting, and other oral and anal penetration.
               </p>

               <p>
                 I understand that these activities involve certain risks and dangers, including the risk of serious injury or death. I voluntarily accept full responsibility for and agree to assume all risks involved.
               </p>

               <p>
                 I am aware that the use of the premises, facilities, and equipment at this event may be dangerous and hazardous and I hereby assume all risks of the use of such premises, facilities, and equipment. I agree to personally inspect all the premises, facilities, and equipment and make my own independent judgment as to the use thereof.
               </p>

               <p>
                 I agree not to rely upon the representations of anyone else in making such judgments. I further agree to treat respectfully and avoid damage to any equipment or facilities provided to me for use. I will clean any equipment or facilities and the surrounding area after the use of any fluids, refuse, or my own private property. I understand that I will be invoiced for any damage or excessive cleaning that I have caused.
               </p>

               <p>
                 I understand that COG Weekend is a private event open only to those who have been approved by Shiny Dog Productions. I understand only COG Weekend attendees and staff, CCBC staff, and contracted security may enter the area from the gate at 14 to the north exit of the Nature Walk. I agree to abide by and follow all the posted safety and use instructions. I further understand that Shiny Dog Productions and the premises owner are not responsible for any lost, damaged or stolen personal property.
               </p>

               <p>
                 As consideration for my being permitted to participate in and/or attend this event, I agree to release hold harmless and indemnify Shiny Dog Productions, CCBC, and other participants from any and all claims, including claims based upon negligence, arising out of my participation, in and/or attendance at this event or any activities associated with this event. This agreement is also binding upon my family members, heirs, and executors.
               </p>

               <p>
                 In the event of any litigation, dispute, or arbitration arising out of this agreement or my participation in and/or attendance at this event, I agree that the sole venue shall be litigation in King County, Washington. Should any portion of this agreement be invalidated all remaining portions of this agreement shall remain in full force and effect.
               </p>

               <h3 className="text-lg font-semibold mt-6">Code of Conduct</h3>
               <p>
                 Upon attending any event hosted by Shiny Dog Productions INC, you affirm your understanding of and consent to the subsequent conditions, which encompass grounds for potential removal or prohibition:
               </p>
               
               <ol className="list-decimal list-inside space-y-2 ml-4">
                 <li><strong>Excessive Drunkenness</strong>: Acknowledgment that excessive alcohol consumption leading to disruptive or unsafe behavior jeopardizes the safety and enjoyment of other attendees and staff.</li>
                 <li><strong>Unwanted Sexual Advances</strong>: Understanding that engaging in unwelcome sexual advances, comments, or behavior that makes other participants uncomfortable or violated is strictly prohibited.</li>
                 <li><strong>Failure to Respect Consent</strong>: Recognition that personal boundaries, consent, and the right to revoke consent at any time must be upheld at all times.</li>
                 <li><strong>Do not interrupt a scene in progress</strong> - do not engage the players in the scene, physically or verbally intrude, or watch from within 3 feet of the act. If a scene concerns you, SAY SOMETHING TO STAFF, do not intervene personally</li>
                 <li><strong>COG Weekend Private Play Spaces have a mandatory Dress Code</strong>. You will be asked to leave and return in more complete gear if arriving with too much skin showing or a lack of scene appropriate attire. Street clothes will not be admitted</li>
                 <li><strong>You are expected to clean up after your scene</strong>. You must sanitize any equipment you use. Any fluids (biological or otherwise) cleaned. Your gear and toys returned to your room</li>
                 <li><strong>All photos or videos you will take will be for non-commercial personal use</strong>. I will ask prior to taking photos or videos of others. Those with a Blue Wristband do not wish to have photos taken of themselves.</li>
                 <li><strong>Destructive Behavior to Venue</strong>: Agreement that actions resulting in damage, defacement, or destruction of the event venue's property are not tolerated.</li>
                 <li><strong>Destructive Behavior to Self</strong>: Acknowledgment of the prohibition against actions that pose harm to oneself or others, including behaviors leading to injury or self-endangerment.</li>
                 <li><strong>Destructive Behavior to Other Attendees or Their Belongings</strong>: Understanding that causing harm to other participants, their personal property, or belongings is strictly prohibited.</li>
                 <li><strong>Excessive Noise</strong>: Acknowledgment of the responsibility to avoid creating excessive noise that disrupts the event environment or neighboring areas.</li>
                 <li><strong>Disrespecting Staff</strong>: Understanding that displaying disrespectful behavior or language towards event staff, volunteers, or organizers is not acceptable.</li>
                 <li><strong>Not Respecting Play Space Etiquette</strong>: Agreement to adhere to established guidelines and rules for respectful behavior within designated play spaces.</li>
                 <li><strong>Substances</strong>: Acknowledgment that possession, use, or distribution of illegal substances during the event is strictly prohibited.</li>
               </ol>

               <h3 className="text-lg font-semibold mt-6">Cancellation & Refund Policy</h3>
               <ul className="list-disc list-inside space-y-2 ml-4">
                 <li><strong>Refund Deadlines</strong>
                   <ul className="list-disc list-inside space-y-1 ml-4 mt-1">
                     <li>Refund requests after purchase will be honored at 75% & less processing fees.</li>
                     <li>Refunds after September 1st, 2025 (Midnight PST) will not be available.</li>
                     <li>Any refunds will be less processing fees.</li>
                     <li>Merchandise sales are final.</li>
                   </ul>
                 </li>
                 <li><strong>Event Cancellation/Rescheduling</strong>: Shiny Dog Productions INC. hereon "COG Weekend" reserves the right to cancel or reschedule an event due to Act of God, domestic or international security concern, epidemic or pandemic (Defined by local government, CDC and/or WHO), venue and/or sub-supplier Force Majeure, low attendance and/or other circumstances which would make the event non-viable defined by COG Weekend.</li>
                 <li><strong>If we have to move COG, we'll try to move your room too</strong>: COG Weekend reserves the right to reschedule an event to any later date deemed viable and safe. In the event of a rescheduling, COG Weekend will act in good faith to schedule new dates with our venue that meets the needs of both COG Weekend and all ticket holders; hereon "You". COG Weekend will not attempt to collect any additional charges from You for admission. COG Weekend will attempt to work with our venue to move existing room reservations to the new date. No guarantee is given that a room reservation rescheduling will incur no additional cost to You nor that the same room will be assigned to You.</li>
                 <li><strong>Please don't ghost us</strong>: Should You decide not to attend COG Weekend for any reason after January 2nd (pending a rescheduling or cancellation), you will not be considered for attendance the following iteration of the event. If You notify COG Weekend between September 2nd and 10 days of the event of your absence, we will wave this clause.</li>
                 <li><strong>Refunds will be performed via our payment processor</strong></li>
                 <li><strong>We'll refund as much as possible if we cancel</strong>: In the event that COG Weekend is canceled, COG Weekend will offer You a refund of the purchased ticket price less processing fees. COG Weekend will attempt to negotiate with our venue to avoid cancellation fees for You, but no guarantee is ensured.</li>
                 <li><strong>Travel is on you</strong>: COG Weekend is not responsible for any travel-related charges you may incur. This includes circumstances where rescheduling or cancellation has occurred. COG Weekend reserves the right to change its Cancellation Policy at any time without notice. COG Weekend also reserves the right to supersede its Cancellation Policy in response to unseen circumstances in a good faith effort to protect both the ticket holders and the continued existence of COG Weekend.</li>
               </ul>

               <h3 className="text-lg font-semibold mt-6">Rooms</h3>
               <ul className="list-disc list-inside space-y-2 ml-4">
                 <li>If you selected a room the hotel will reach out after registration is complete.</li>
                 <li>Please DO NOT call the resort. They will call you. Please sit tight.</li>
                 <li>If you have a ticket for a room, it is blocked for you.</li>
                 <li>If the resort has not called you after two weeks of ticket booking, please email hello@shinydogproductions.com</li>
               </ul>

               <p><strong>Minimum Level Hotel Per Room for Weekend Period (Th-Sat Nights)</strong></p>
               <ul className="list-disc list-inside space-y-1 ml-4">
                 <li>King Rooms - Minimum Two (2) Attendees / Maximum Three (3) Attendees</li>
                 <li>2x Queen Rooms - Minimum Four (4) Attendees / Maximum Four (4) Attendees</li>
                 <li>RV+ - Minimum One (1) Attendees / Maximum Two (2) Attendees</li>
               </ul>

               <p>If I'm a room lead/holder, I understand that will do my best to fill the room to the minimum level on the weekends. This does not apply Monday-Wens.</p>

               <h3 className="text-lg font-semibold mt-6">Communication</h3>
               <p>Our primary form of communication is email (formally) & our Telegram group (informally).</p>
               <p>All attendees must join the 2025 Telegram group via the link in the Waiver approval email.</p>

               <h3 className="text-lg font-semibold mt-6">I, the undersigned, have;</h3>
               <ul className="list-disc list-inside space-y-2 ml-4">
                 <li>Carefully read this document, fully understand its content, and agree to be bound by the terms.</li>
                 <li>My signature below is my true legal name.</li>
                 <li>Understand that upon check-in I must present a government-issued photo ID that matches the waiver and registration information or be denied entrance.</li>
                 <li>Understand that COG is an event for men in gear and will be expected to participate in wearing gear during the event weekend.</li>
                 <li>The COG playspace and scheduled events require a majority coverage of fetish gear and admittance to events and playspace will be denied if I am not in gear. (no only jockstraps, etc.) Basically, if you plan to wear just a jock and harness, COG Weekend is not for you.</li>
               </ul>

               <p>Questions - <a href="mailto:hello@shinydogproductions.com" className="text-blue-400 hover:underline">hello@shinydogproductions.com</a></p>
             </div>
           </div>

          {/* Personal Information Fields */}
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold text-white font-montserrat">Personal Information</h3>

            
            <div className="space-y-4">
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
                    className={`bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 placeholder:text-[#666666] text-sm cursor-not-allowed ${
                          showValidation && validationErrors.firstName ? 'border-red-500' : ''
                        }`}
                    disabled
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
                    className={`bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 placeholder:text-[#666666] text-sm cursor-not-allowed ${
                          showValidation && validationErrors.lastName ? 'border-red-500' : ''
                        }`}
                    disabled
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
                  className={`bg-[#2a2a2a] border-[#3a3a3a] text-gray-400 placeholder:text-[#666666] text-sm cursor-not-allowed ${
                        showValidation && validationErrors.email ? 'border-red-500' : ''
                      }`}
                  disabled
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
                  disabled={true}
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

                  <div className="flex flex-col space-y-2 pb-4">
                    <Label className="text-white font-montserrat text-sm">
                      Emergency Phone <span className="text-red-400">*</span>
                    </Label>
                    <PhoneInput
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
        <Card className="p-3 sm:p-6 bg-[#111111] border-[#5c5c5c]">
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
