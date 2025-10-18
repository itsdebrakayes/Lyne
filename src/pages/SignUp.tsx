import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const SignUp = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    idNumber: "",
    age: "",
    dob: undefined as Date | undefined,
    email: "",
    password: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Store user data (in real app, this would be sent to backend)
    localStorage.setItem("userData", JSON.stringify(formData));
    navigate("/service-select");
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate("/taj")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Create Account</h1>
          <p className="text-muted-foreground">Sign up to join the queue</p>
        </div>

        <GlassCard className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                required
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                className="glass"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="idNumber">ID Number</Label>
              <Input
                id="idNumber"
                required
                value={formData.idNumber}
                onChange={(e) =>
                  setFormData({ ...formData, idNumber: e.target.value })
                }
                className="glass"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  required
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                  className="glass"
                />
              </div>

              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal glass",
                        !formData.dob && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dob ? format(formData.dob, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.dob}
                      onSelect={(date) =>
                        setFormData({ ...formData, dob: date })
                      }
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="glass"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="glass"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary-dark"
              size="lg"
            >
              Continue
            </Button>
          </form>
        </GlassCard>

        <div className="text-center">
          <Button
            variant="link"
            onClick={() => navigate("/login")}
          >
            Already have an account? Sign in
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
